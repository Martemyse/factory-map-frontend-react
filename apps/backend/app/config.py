import os
from pydantic import BaseModel
try:
  from dotenv import load_dotenv
  load_dotenv()
except Exception:
  pass


class Settings(BaseModel):
  dev_mode: bool = os.getenv('DEV_MODE', 'true').lower() in ('1', 'true', 'yes')
  pg_user: str = os.getenv('PG_USER', 'postgres')
  pg_password: str = os.getenv('PG_PASSWORD', 'martinmi')
  pg_host_dev: str = os.getenv('PG_HOST_DEV', 'localhost')
  pg_host_prod: str = os.getenv('PG_HOST_PROD', 'postgres_c')
  pg_port: int = int(os.getenv('PG_PORT', '5432'))
  pg_db: str = os.getenv('PG_DB', 'layout_proizvodnja_libre_konva')
  
  # Source database for production data
  source_pg_db: str = os.getenv('SOURCE_PG_DB', 'bpsna_dobri_slabi_lj')

  @property
  def pg_host(self) -> str:
    return self.pg_host_dev if self.dev_mode else self.pg_host_prod

  @property
  def sync_database_url(self) -> str:
    return f"postgresql+psycopg2://{self.pg_user}:{self.pg_password}@{self.pg_host}:{self.pg_port}/{self.pg_db}"

  @property
  def async_database_url(self) -> str:
    return f"postgresql+asyncpg://{self.pg_user}:{self.pg_password}@{self.pg_host}:{self.pg_port}/{self.pg_db}"
  
  @property
  def source_database_url(self) -> str:
    return f"postgresql+psycopg2://{self.pg_user}:{self.pg_password}@{self.pg_host}:{self.pg_port}/{self.source_pg_db}"


settings = Settings()

