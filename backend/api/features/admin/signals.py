from django.core.cache import cache
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import TodaStation, Toda


@receiver([post_save, post_delete], sender=TodaStation)
def invalidate_toda_station_cache(sender, instance, **kwargs):
    cache.delete(f"toda_stations_list:{instance.toda_id}")
    cache.delete("toda_stations_list:all")
    if instance.toda_id:
        cache.delete(f"toda_stations_prefix:{instance.toda.prefix}")


@receiver([post_save, post_delete], sender=Toda)
def invalidate_toda_boundary_cache(sender, instance, **kwargs):
    cache.delete("toda_boundaries_list")
    cache.delete(f"toda_stations_prefix:{instance.prefix}")