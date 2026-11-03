from django.test import TestCase
from .test.PassengerAuthTest import PassengerListCreateViewTests, PassengerRetrieveUpdateDestroyViewTests
from .test.DriverAuthTest import DriverListCreateViewTests, DriverRetrieveUpdateDestroyViewTests
from .test.LoginAuthTest import UserLoginTests, AdminLoginTests, TokenRefreshTests
from .test.AdminModuleTest import *
from .test.SecurityFixesTest import *
# Create your tests here.
from .test.BookingFlowTest import *
from .test.ChatAndReportsTest import *
from .test.NotificationsTest import *
from .test.WebsocketConsumersTest import *
