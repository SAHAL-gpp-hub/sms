from locust import TaskSet, task


class AdminUserTasks(TaskSet):
    def on_start(self):
        r = self.client.post(
            "/api/v1/auth/login",
            data={"username": "admin@iqra.in", "password": "Admin@123"},
        )
        token = r.json().get("access_token", "")
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}

    @task(3)
    def view_defaulters(self):
        self.client.get("/api/v1/fees/defaulters", headers=self.headers, name="admin/defaulters")

    @task(1)
    def download_pdf_report(self):
        self.client.get("/api/v1/pdf/report/defaulters", headers=self.headers, name="admin/defaulters_pdf")
