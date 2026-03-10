from __future__ import annotations

from pathlib import Path

import boto3

from app.core.config import get_settings


class StorageService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = boto3.client(
            "s3",
            endpoint_url=self.settings.r2_endpoint_url,
            aws_access_key_id=self.settings.r2_access_key_id,
            aws_secret_access_key=self.settings.r2_secret_access_key,
            region_name=self.settings.r2_region,
        )

    def upload_file(self, local_path: Path, object_name: str) -> str:
        self.client.upload_file(str(local_path), self.settings.r2_bucket_name, object_name)
        if self.settings.r2_public_base_url:
            return f"{self.settings.r2_public_base_url.rstrip('/')}/{object_name}"
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.settings.r2_bucket_name, "Key": object_name},
            ExpiresIn=3600,
        )
