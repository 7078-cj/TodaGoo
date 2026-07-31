from ...admin.models import Toda

def get_nearest_toda(booking):
    start = booking.start

    toda = Toda.objects.filter(area__contains=start).first()
    if toda:
        return toda

    else:
        return None