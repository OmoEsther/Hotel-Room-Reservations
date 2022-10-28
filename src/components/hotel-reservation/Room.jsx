import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Badge,
  Button,
  Card,
  Col,
  FloatingLabel,
  Form,
  Stack,
} from "react-bootstrap";
import {
  microAlgosToString,
  truncateAddress,
  convertTime,
} from "../../utils/conversions";
import Identicon from "../utils/Identicon";

const Room = ({
  address,
  room,
  makeReservation,
  endReservation,
  deleteRoom,
}) => {
  const {
    appId,
    name,
    image,
    description,
    price,
    reservedTo,
    reserveEnds,
    isReserved,
    appCreator,
  } = room;

  const date = Date.now();

  const [noOfNights, setNoOfNights] = useState(1);

  const roomIsReserved = () => isReserved === 1;

  const reservationEnded = () => date >= new Date(reserveEnds * 1000);
  return (
    <Col key={appId}>
      <Card className="h-100">
        <Card.Header>
          <Stack direction="horizontal" gap={2}>
            <span className="font-monospace text-secondary">
              {reservedTo ? truncateAddress(reservedTo) : <></>}
            </span>
            <Identicon size={28} address={reservedTo} />
            <Badge bg="secondary" className="ms-auto">
              {roomIsReserved() ? "RESERVED" : "AVAILABLE"}
            </Badge>
          </Stack>
        </Card.Header>
        <div className="ratio ratio-4x3">
          <img src={image} alt={name} style={{ objectFit: "cover" }} />
        </div>
        <Card.Body className="d-flex flex-column text-center">
          <Card.Title>{name}</Card.Title>
          <Card.Text className="flex-grow-1">{description}</Card.Text>
          <Card.Text className="flex-grow-1">
            {reserveEnds ? `Reservation ends: ${convertTime(reserveEnds)}` : ""}
          </Card.Text>
          <Form className="d-flex align-content-stretch flex-row gap-2">
            {reservedTo === address && roomIsReserved() ? (
              <Button
                variant="outline-dark"
                onClick={() => endReservation(room)}
                disabled={!reservationEnded()}
                className="w-100 py-3"
              >
                End Reservation
              </Button>
            ) : roomIsReserved() ? (
              <>
                <Button
                  variant="outline-dark"
                  disabled={roomIsReserved()}
                  className="w-100 py-3"
                >
                  Reserved
                </Button>
              </>
            ) : (
              <>
                <FloatingLabel
                  controlId="inputCount"
                  label="Nights"
                  className="w-25"
                >
                  <Form.Control
                    type="number"
                    value={noOfNights}
                    min="1"
                    disabled={roomIsReserved()}
                    onChange={(e) => {
                      setNoOfNights(Number(e.target.value));
                    }}
                  />
                </FloatingLabel>
                <Button
                  variant="outline-dark"
                  disabled={roomIsReserved()}
                  onClick={() => makeReservation(room, noOfNights)}
                  className="w-75 py-3"
                >
                  Reserve for {microAlgosToString(price) * noOfNights} ALGO
                </Button>
              </>
            )}
            {appCreator === address && (
              <Button
                variant="outline-danger"
                onClick={() => deleteRoom(room)}
                className="btn"
              >
                <i className="bi bi-trash"></i>
              </Button>
            )}
          </Form>
        </Card.Body>
      </Card>
    </Col>
  );
};

Room.propTypes = {
  address: PropTypes.string.isRequired,
  room: PropTypes.instanceOf(Object).isRequired,
  makeReservation: PropTypes.func.isRequired,
  endReservation: PropTypes.func.isRequired,
  deleteRoom: PropTypes.func.isRequired,
};

export default Room;
