from ...admin.models import Toda

def get_nearest_toda(booking):
    return Toda.objects.filter(area__contains=booking.start).first()