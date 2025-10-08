import os
import platform
from pydantic import BaseModel
try:
  from dotenv import load_dotenv
  load_dotenv()
except Exception:
  pass


class Settings(BaseModel):
  # OS-based detection: Windows = development, Linux = production
  dev_mode: bool = platform.system() == 'Windows'
  pg_user: str = os.getenv('PG_USER', 'postgres')
  pg_password: str = os.getenv('PG_PASSWORD', 'martinmi')
  pg_host_dev: str = os.getenv('PG_HOST_DEV', 'localhost')
  pg_host_prod: str = os.getenv('PG_HOST_PROD', 'postgres_c')
  pg_port: int = int(os.getenv('PG_PORT', '5432'))
  pg_db: str = os.getenv('PG_DB', 'layout_proizvodnja_libre_konva')
  
  # Source database for production data
  source_pg_db: str = os.getenv('SOURCE_PG_DB', 'bpsna_dobri_slabi_lj')
  
  # Port configuration based on OS
  backend_port_dev: int = int(os.getenv('BACKEND_PORT_DEV', '7998'))
  backend_port_prod: int = int(os.getenv('BACKEND_PORT_PROD', '7998'))
  frontend_port_dev: int = int(os.getenv('FRONTEND_PORT_DEV', '8082'))
  frontend_port_prod: int = int(os.getenv('FRONTEND_PORT_PROD', '8082'))

  @property
  def pg_host(self) -> str:
    return self.pg_host_dev if self.dev_mode else self.pg_host_prod

  @property
  def backend_port(self) -> int:
    return self.backend_port_dev if self.dev_mode else self.backend_port_prod

  @property
  def frontend_port(self) -> int:
    return self.frontend_port_dev if self.dev_mode else self.frontend_port_prod

  @property
  def frontend_url(self) -> str:
    if self.dev_mode:
      return f"http://localhost:{self.frontend_port}"
    else:
      return f"http://React_App_Factory_Map_Frontend:{self.frontend_port}"

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

