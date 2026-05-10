from locust import TaskSet, task
import random


class ParentUserTasks(TaskSet):
    def on_start(self):
        r = self.client.post(
            "/api/v1/auth/login",
            data={
                "username": f"parent{random.randint(1, 100)}@test.com",
                "password": "Parent@123",
            },
        )
        token = r.json().get("access_token", "")
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}

    @task(5)
    def view_dashboard(self):
        self.client.get("/api/v1/portal/me/profile", headers=self.headers, name="parent/profile")

    @task(3)
    def view_results(self):
        self.client.get("/api/v1/portal/me/results", headers=self.headers, name="parent/results")

    @task(2)
    def view_fees(self):
        self.client.get("/api/v1/portal/me/fees", headers=self.headers, name="parent/fees")

    @task(1)
    def view_attendance(self):
        self.client.get("/api/v1/portal/me/attendance", headers=self.headers, name="parent/attendance")
