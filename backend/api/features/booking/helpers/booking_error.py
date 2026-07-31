from ....broadcast import broadcast

def booking_error(message, user_id, booking, transaction):
    booking_id = booking.id
    booking.delete()
    transaction.on_commit(
        lambda: broadcast(
            f"user_{user_id}",
            "booking_unavailable",
            {"booking_id": booking_id, "message": message},
        )
    )