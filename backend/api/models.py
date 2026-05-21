
from django.db import models
from .features.user.models import *
from django.contrib.auth.models import User
#import the models here in nested folder to migrate


from .features.passenger.models import *
from .features.driver.models import *
from .features.booking.models import *
from .features.reports.models import *
