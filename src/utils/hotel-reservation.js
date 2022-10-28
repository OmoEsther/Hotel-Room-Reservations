import algosdk from "algosdk";
import { Base64 } from "js-base64";
import {
  algodClient,
  indexerClient,
  hotelNote,
  minRound,
  myAlgoConnect,
  numGlobalBytes,
  numGlobalInts,
  numLocalBytes,
  numLocalInts,
} from "./constants";
/* eslint import/no-webpack-loader-syntax: off */
import approvalProgram from "!!raw-loader!../contracts/hotel_approval.teal";
import clearProgram from "!!raw-loader!../contracts/hotel_clear.teal";
import { base64ToUTF8String, utf8ToBase64String } from "./conversions";

class Room {
  constructor(
    appCreator,
    appId,
    appAddress,
    name,
    image,
    description,
    price,
    reservedTo,
    reserveEnds,
    isReserved
  ) {
    this.appId = appId;
    this.appCreator = appCreator;
    this.appAddress = appAddress;
    this.name = name;
    this.image = image;
    this.description = description;
    this.price = price;
    this.reservedTo = reservedTo;
    this.reserveEnds = reserveEnds;
    this.isReserved = isReserved;
  }
}

// Compile smart contract in .teal format to program
const compileProgram = async (programSource) => {
  let encoder = new TextEncoder();
  let programBytes = encoder.encode(programSource);
  let compileResponse = await algodClient.compile(programBytes).do();
  return new Uint8Array(Buffer.from(compileResponse.result, "base64"));
};

// CREATE ROOM: ApplicationCreateTxn
export const createRoomAction = async (senderAddress, room) => {
  console.log("Adding room...");

  let params = await algodClient.getTransactionParams().do();

  // Compile programs
  const compiledApprovalProgram = await compileProgram(approvalProgram);
  const compiledClearProgram = await compileProgram(clearProgram);

  // Build note to identify transaction later and required app args as Uint8Arrays
  let note = new TextEncoder().encode(hotelNote);
  let name = new TextEncoder().encode(room.name);
  let image = new TextEncoder().encode(room.image);
  let description = new TextEncoder().encode(room.description);
  let price = algosdk.encodeUint64(room.price);

  let appArgs = [name, image, description, price];

  // Create ApplicationCreateTxn
  let txn = algosdk.makeApplicationCreateTxnFromObject({
    from: senderAddress,
    suggestedParams: params,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: compiledApprovalProgram,
    clearProgram: compiledClearProgram,
    numLocalInts: numLocalInts,
    numLocalByteSlices: numLocalBytes,
    numGlobalInts: numGlobalInts,
    numGlobalByteSlices: numGlobalBytes,
    note: note,
    appArgs: appArgs,
  });

  // Get transaction ID
  let txId = txn.txID().toString();

  // Sign & submit the transaction
  let signedTxn = await myAlgoConnect.signTransaction(txn.toByte());
  console.log("Signed transaction with txID: %s", txId);
  await algodClient.sendRawTransaction(signedTxn.blob).do();

  // Wait for transaction to be confirmed
  let confirmedTxn = await algosdk.waitForConfirmation(algodClient, txId, 4);

  // Get the completed Transaction
  console.log(
    "Transaction " +
      txId +
      " confirmed in round " +
      confirmedTxn["confirmed-round"]
  );

  // Get created application id and notify about completion
  let transactionResponse = await algodClient
    .pendingTransactionInformation(txId)
    .do();
  let appId = transactionResponse["application-index"];
  console.log("Created new app-id: ", appId);
  return appId;
};

// Reserve room: Group transaction consisting of ApplicationCallTxn and PaymentTxn
export const makeReservationAction = async (
  senderAddress,
  room,
  noOfNights
) => {
  console.log("Reserving room...");

  let params = await algodClient.getTransactionParams().do();

  // Build required app args as Uint8Array
  let appCallArg = new TextEncoder().encode("make");
  let noOfNightsArg = algosdk.encodeUint64(noOfNights);
  let appArgs = [appCallArg, noOfNightsArg];

  // Create ApplicationCallTxn
  let appCallTxn = algosdk.makeApplicationCallTxnFromObject({
    from: senderAddress,
    appIndex: room.appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: params,
    appArgs: appArgs,
  });

  let totalAmount = room.price * noOfNights + 1000000; // fee

  // Create PaymentTxn
  let paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: senderAddress,
    to: room.appAddress,
    amount: totalAmount,
    suggestedParams: params,
  });

  let txnArray = [appCallTxn, paymentTxn];

  // Create group transaction out of previously build transactions
  let groupID = algosdk.computeGroupID(txnArray);
  for (let i = 0; i < 2; i++) txnArray[i].group = groupID;

  // Sign & submit the group transaction
  let signedTxn = await myAlgoConnect.signTransaction(
    txnArray.map((txn) => txn.toByte())
  );
  console.log("Signed group transaction");
  let tx = await algodClient
    .sendRawTransaction(signedTxn.map((txn) => txn.blob))
    .do();

  // Wait for group transaction to be confirmed
  let confirmedTxn = await algosdk.waitForConfirmation(algodClient, tx.txId, 4);

  // Notify about completion
  console.log(
    "Group transaction " +
      tx.txId +
      " confirmed in round " +
      confirmedTxn["confirmed-round"]
  );
};

// End Reservation room: ApplicationCallTxn
export const endReservationAction = async (senderAddress, room) => {
  console.log("Ending reservation...");

  let params = await algodClient.getTransactionParams().do();
  params.fee = algosdk.ALGORAND_MIN_TX_FEE * 2;
  params.flatFee = true;

  // Build required app args as Uint8Array
  let appCallArg = new TextEncoder().encode("end");
  let appArgs = [appCallArg];

  // Create ApplicationCallTxn
  let appCallTxn = algosdk.makeApplicationCallTxnFromObject({
    from: senderAddress,
    appIndex: room.appId,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    suggestedParams: params,
    appArgs: appArgs,
  });

  // Get transaction ID
  let txId = appCallTxn.txID().toString();

  // Sign & submit the transaction
  let signedTxn = await myAlgoConnect.signTransaction(appCallTxn.toByte());
  console.log("Signed transaction with txID: %s", txId);
  await algodClient.sendRawTransaction(signedTxn.blob).do();

  // Wait for transaction to be confirmed
  const confirmedTxn = await algosdk.waitForConfirmation(algodClient, txId, 4);

  // Get the completed Transaction
  console.log(
    "Transaction " +
      txId +
      " confirmed in round " +
      confirmedTxn["confirmed-round"]
  );
};

// DELETE room: ApplicationDeleteTxn
export const deleteroomAction = async (senderAddress, index) => {
  console.log("Deleting application...");

  let params = await algodClient.getTransactionParams().do();

  // Create ApplicationDeleteTxn
  let txn = algosdk.makeApplicationDeleteTxnFromObject({
    from: senderAddress,
    suggestedParams: params,
    appIndex: index,
  });

  // Get transaction ID
  let txId = txn.txID().toString();

  // Sign & submit the transaction
  let signedTxn = await myAlgoConnect.signTransaction(txn.toByte());
  console.log("Signed transaction with txID: %s", txId);
  await algodClient.sendRawTransaction(signedTxn.blob).do();

  // Wait for transaction to be confirmed
  const confirmedTxn = await algosdk.waitForConfirmation(algodClient, txId, 4);

  // Get the completed Transaction
  console.log(
    "Transaction " +
      txId +
      " confirmed in round " +
      confirmedTxn["confirmed-round"]
  );

  // Get application id of deleted application and notify about completion
  let transactionResponse = await algodClient
    .pendingTransactionInformation(txId)
    .do();
  let appId = transactionResponse["txn"]["txn"].apid;
  console.log("Deleted app-id: ", appId);
};

// GET roomS: Use indexer
export const getRoomsAction = async () => {
  console.log("Fetching rooms...");
  let note = new TextEncoder().encode(hotelNote);
  let encodedNote = Buffer.from(note).toString("base64");

  // Step 1: Get all transactions by notePrefix (+ minRound filter for performance)
  let transactionInfo = await indexerClient
    .searchForTransactions()
    .notePrefix(encodedNote)
    .txType("appl")
    .minRound(minRound)
    .do();

  let rooms = [];
  for (const transaction of transactionInfo.transactions) {
    let appId = transaction["created-application-index"];
    if (appId) {
      // Step 2: Get each application by application id
      let room = await getApplication(appId);
      if (room) {
        rooms.push(room);
      }
    }
  }
  console.log("rooms fetched.");
  return rooms;
};

const getApplication = async (appId) => {
  try {
    // 1. Get application by appId
    let response = await indexerClient
      .lookupApplications(appId)
      .includeAll(true)
      .do();
    if (response.application.deleted) {
      return null;
    }
    let globalState = response.application.params["global-state"];

    // 2. Parse fields of response and return room
    let appCreator = response.application.params.creator;
    let appAddress = algosdk.getApplicationAddress(appId);
    let name = "";
    let image = "";
    let description = "";
    let price = 0;
    let reservedTo = "";
    let reserveEnds = 0;
    let isReserved = 0;

    const getField = (fieldName, globalState) => {
      return globalState.find((state) => {
        return state.key === utf8ToBase64String(fieldName);
      });
    };

    if (getField("NAME", globalState) !== undefined) {
      let field = getField("NAME", globalState).value.bytes;
      name = base64ToUTF8String(field);
    }

    if (getField("IMAGE", globalState) !== undefined) {
      let field = getField("IMAGE", globalState).value.bytes;
      image = base64ToUTF8String(field);
    }

    if (getField("DESCRIPTION", globalState) !== undefined) {
      let field = getField("DESCRIPTION", globalState).value.bytes;
      description = base64ToUTF8String(field);
    }

    if (getField("PRICE", globalState) !== undefined) {
      price = getField("PRICE", globalState).value.uint;
    }

    if (getField("RESERVE_ENDS", globalState) !== undefined) {
      reserveEnds = getField("RESERVE_ENDS", globalState).value.uint;
    }

    if (getField("RESERVED", globalState) !== undefined) {
      isReserved = getField("RESERVED", globalState).value.uint;
    }

    if (getField("RESERVED_TO", globalState) !== undefined) {
      let field = getField("RESERVED_TO", globalState).value.bytes;
      if (isReserved === 1) {
        reservedTo = algosdk.encodeAddress(Base64.toUint8Array(field));
      }
    }

    return new Room(
      appCreator,
      appId,
      appAddress,
      name,
      image,
      description,
      price,
      reservedTo,
      reserveEnds,
      isReserved
    );
  } catch (err) {
    return null;
  }
};
