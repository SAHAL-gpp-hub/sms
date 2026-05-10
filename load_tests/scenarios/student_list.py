from locust import TaskSet, task
import random


class TeacherReadOnlyTasks(TaskSet):
    def on_start(self):
        r = self.client.post(
            "/api/v1/auth/login",
            data={
                "username": f"teacher{random.randint(1, 5)}@iqra.in",
                "password": "Teacher@123",
            },
        )
        token = r.json().get("access_token", "")
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}

    @task(5)
    def list_students(self):
        self.client.get("/api/v1/students/?class_id=5", headers=self.headers, name="teacher/list_students")

    @task(3)
    def view_attendance(self):
        self.client.get(
            "/api/v1/attendance/monthly?class_id=5&year=2026&month=4",
            headers=self.headers,
            name="teacher/monthly_attendance",
        )
