import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import AddRoom from "./AddRoom";
import Room from "./Room";
import Loader from "../utils/Loader";
import { NotificationError, NotificationSuccess } from "../utils/Notifications";
import {
  createRoomAction,
  makeReservationAction,
  endReservationAction,
  deleteroomAction,
  getRoomsAction,
} from "../../utils/hotel-reservation";
import PropTypes from "prop-types";
import { Row } from "react-bootstrap";

const Rooms = ({ address, fetchBalance }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  const getRooms = async () => {
    setLoading(true);
    getRoomsAction()
      .then((rooms) => {
        if (rooms) {
          setRooms(rooms);
        }
      })
      .catch((error) => {
        console.log(error);
      })
      .finally((_) => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getRooms();
  }, []);

  const createNewRoom = async (data) => {
    setLoading(true);
    createRoomAction(address, data)
      .then(() => {
        toast(<NotificationSuccess text="Room added successfully." />);
        getRooms();
        fetchBalance(address);
      })
      .catch((error) => {
        console.log(error);
        toast(<NotificationError text="Failed to create room." />);
        setLoading(false);
      });
  };

  const makeReservation = async (room, noOfNights) => {
    setLoading(true);
    makeReservationAction(address, room, noOfNights)
      .then(() => {
        toast(<NotificationSuccess text="Reservation made successfully" />);
        getRooms();
        fetchBalance(address);
      })
      .catch((error) => {
        console.log(error);
        toast(<NotificationError text="Failed to make reservation." />);
        setLoading(false);
      });
  };

  const endReservation = async (room) => {
    setLoading(true);
    endReservationAction(address, room)
      .then(() => {
        toast(<NotificationSuccess text="Reservation ended successfully" />);
        getRooms();
        fetchBalance(address);
      })
      .catch((error) => {
        console.log(error);
        toast(<NotificationError text="Failed to end reservation." />);
        setLoading(false);
      });
  };

  const deleteRoom = async (room) => {
    setLoading(true);
    deleteroomAction(address, room.appId)
      .then(() => {
        toast(<NotificationSuccess text="Room deleted successfully" />);
        getRooms();
        fetchBalance(address);
      })
      .catch((error) => {
        console.log(error);
        toast(<NotificationError text="Failed to delete room." />);
        setLoading(false);
      });
  };

  if (loading) {
    return <Loader />;
  }
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="fs-4 fw-bold mb-0">Hotel Rooms Reservation</h1>
        <AddRoom createNewRoom={createNewRoom} />
      </div>
      <div className="mb-3">
        <i className="bi bi-bell-fill"></i> Holding fee for any reservation is 1
        Algo.
      </div>
      <Row xs={1} sm={2} lg={3} className="g-3 mb-5 g-xl-4 g-xxl-5">
        <>
          {rooms.map((room, index) => (
            <Room
              address={address}
              room={room}
              makeReservation={makeReservation}
              endReservation={endReservation}
              deleteRoom={deleteRoom}
              key={index}
            />
          ))}
        </>
      </Row>
    </>
  );
};

Rooms.propTypes = {
  address: PropTypes.string.isRequired,
  fetchBalance: PropTypes.func.isRequired,
};

export default Rooms;
