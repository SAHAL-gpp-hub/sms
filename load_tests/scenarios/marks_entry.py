from locust import TaskSet, task
import random


class TeacherUserTasks(TaskSet):
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

    @task(1)
    def save_marks(self):
        payload = {
            "class_id": 5,
            "exam_id": 1,
            "entries": [
                {"student_id": i, "subject_id": 1, "theory_marks": 75}
                for i in range(1, 41)
            ],
        }
        self.client.post("/api/v1/marks/bulk", headers=self.headers, json=payload, name="teacher/bulk_marks")
