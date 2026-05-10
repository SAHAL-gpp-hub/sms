from locust import HttpUser, between

from scenarios.fee_payment import AdminUserTasks
from scenarios.marks_entry import TeacherUserTasks
from scenarios.portal_login import ParentUserTasks
from scenarios.student_list import TeacherReadOnlyTasks


class AdminUser(HttpUser):
    wait_time = between(1, 3)
    weight = 1
    tasks = [AdminUserTasks]


class TeacherUser(HttpUser):
    wait_time = between(0.5, 2)
    weight = 10
    tasks = [TeacherUserTasks, TeacherReadOnlyTasks]


class ParentUser(HttpUser):
    wait_time = between(2, 5)
    weight = 50
    tasks = [ParentUserTasks]
