from django.test import TestCase
from .test.PassengerAuthTest import PassengerListCreateViewTests, PassengerRetrieveUpdateDestroyViewTests
from .test.DriverAuthTest import DriverListCreateViewTests, DriverRetrieveUpdateDestroyViewTests
from .test.LoginAuthTest import UserLoginTests, AdminLoginTests, TokenRefreshTests, TokenUsageTests
from .test.AdminModuleTest import *
from .test.SecurityFixesTest import *
# Create your tests here.
from .test.BookingFlowTest import *
from .test.ChatAndReportsTest import *
from .test.NotificationsTest import *
from .test.WebsocketConsumersTest import *
from .test.ProfileTest import *
from .test.OfferFlowTest import *
# `manage.py test` (and CI) only runs what's imported here: add every new test module
from .test.SmsPasswordResetTest import *
