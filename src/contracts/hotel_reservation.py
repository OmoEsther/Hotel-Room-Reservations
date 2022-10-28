from pyteal import *


class Room:

    class Variables:
        name = Bytes("NAME")
        image = Bytes("IMAGE")
        description = Bytes("DESCRIPTION")
        price_per_night = Bytes("PRICE")
        is_reserved = Bytes("RESERVED")
        current_reserved_to = Bytes("RESERVED_TO")
        current_reservation_ends = Bytes("RESERVE_ENDS")
        reservation_fee = Int(1000000)  # will be refunded

        # ideally would be in nights but for testing purposes
        min_in_seconds = Int(60)

    class App_Methods:
        make_reservation = Bytes("make")
        end_reservation = Bytes("end")

    def application_creation(self):
        return Seq([
            Assert(Txn.application_args.length() == Int(4)),
            Assert(Txn.note() == Bytes("hotel-reservation:uv1")),
            Assert(Btoi(Txn.application_args[3]) > Int(0)),
            App.globalPut(self.Variables.name, Txn.application_args[0]),
            App.globalPut(self.Variables.image, Txn.application_args[1]),
            App.globalPut(self.Variables.description, Txn.application_args[2]),
            App.globalPut(self.Variables.price_per_night,
                          Btoi(Txn.application_args[3])),
            App.globalPut(self.Variables.is_reserved, Int(0)),
            Approve()
        ])

    def make_reservation(self):
        no_of_nights = Txn.application_args[1]
        no_of_nights_in_seconds = Btoi(
            no_of_nights) * self.Variables.min_in_seconds

        valid_number_of_transactions = Global.group_size() == Int(2)

        total_amount_to_be_sent = (App.globalGet(
            self.Variables.price_per_night) * Btoi(no_of_nights)) + self.Variables.reservation_fee

        valid_payment_to_contract = And(
            Gtxn[1].type_enum() == TxnType.Payment,
            Gtxn[1].receiver() == Global.current_application_address(),
            Gtxn[1].amount() == total_amount_to_be_sent,
            Gtxn[1].sender() == Gtxn[0].sender(),
        )

        is_not_reserved = App.globalGet(self.Variables.is_reserved) == Int(0)

        can_proceed = And(
            is_not_reserved,
            valid_number_of_transactions,
            valid_payment_to_contract
        )

        update_state = Seq([
            App.globalPut(self.Variables.current_reserved_to, Txn.accounts[0]),
            App.globalPut(
                self.Variables.current_reservation_ends,
                Global.latest_timestamp() + no_of_nights_in_seconds),
            App.globalPut(self.Variables.is_reserved, Int(1)),
            Approve()
        ])

        return If(can_proceed).Then(update_state).Else(Reject())

    @ Subroutine(TealType.none)
    def send_funds(account: Expr, amount: Expr):
        return Seq(
            InnerTxnBuilder.Begin(),
            InnerTxnBuilder.SetFields(
                {
                    TxnField.type_enum: TxnType.Payment,
                    TxnField.receiver: account,
                    TxnField.amount: amount,
                    TxnField.fee: Int(0),
                }
            ),
            InnerTxnBuilder.Submit(),
        )

    def end_reservation(self):
        reservation_ended = Global.latest_timestamp() >= App.globalGet(
            self.Variables.current_reservation_ends)

        is_reserved = App.globalGet(self.Variables.is_reserved) == Int(1)

        is_reservee = App.globalGet(
            self.Variables.current_reserved_to) == Txn.accounts[0]

        txn_fee_pooled = Txn.fee() >= Global.min_txn_fee() * Int(2)

        can_proceed = And(reservation_ended, is_reserved,
                          is_reservee, txn_fee_pooled)

        refund_reserve_fee = self.send_funds(
            Txn.accounts[0], self.Variables.reservation_fee)

        update_state = Seq([
            refund_reserve_fee,
            App.globalPut(self.Variables.current_reserved_to, Bytes("")),
            App.globalPut(
                self.Variables.current_reservation_ends, Int(0)),
            App.globalPut(self.Variables.is_reserved, Int(0)),
            Approve()

        ])

        return If(can_proceed).Then(update_state).Else(Reject())

    def application_deletion(self):
        return Return(Txn.sender() == Global.creator_address())

    def application_start(self):
        return Cond(
            [Txn.application_id() == Int(0), self.application_creation()],
            [Txn.on_completion() == OnComplete.DeleteApplication,
             self.application_deletion()],
            [Txn.application_args[0] == self.App_Methods.make_reservation,
                self.make_reservation()],
            [Txn.application_args[0] ==
                self.App_Methods.end_reservation, self.end_reservation()]
        )

    def approval_program(self):
        return self.application_start()

    def clear_program(self):
        return Return(Int(1))
