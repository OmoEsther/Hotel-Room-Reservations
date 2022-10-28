from pyteal import *

from hotel_reservation import Room

if __name__ == "__main__":
    approval_program = Room().approval_program()
    clear_program = Room().clear_program()

    # Mode.Application specifies that this is a smart contract
    compiled_approval = compileTeal(approval_program, Mode.Application, version=6)
    print(compiled_approval)
    with open("src/contracts/hotel_approval.teal", "w") as teal:
        teal.write(compiled_approval)
        teal.close()

    # Mode.Application specifies that this is a smart contract
    compiled_clear = compileTeal(clear_program, Mode.Application, version=6)
    print(compiled_clear)
    with open("src/contracts/hotel_clear.teal", "w") as teal:
        teal.write(compiled_clear)
        teal.close()
