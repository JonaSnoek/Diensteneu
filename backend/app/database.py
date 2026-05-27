from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import load_config
import os

Base = declarative_base()

_engine = None
_SessionFactory = None

def get_db_engine():
    global _engine, _SessionFactory
    config = load_config()
    db_url = config.database_url
    
    # Resolve relative SQLite paths to DATA_DIR for consistency
    if db_url.startswith("sqlite:///"):
        db_path = db_url.replace("sqlite:///", "")
        if not os.path.isabs(db_path):
            db_url = f"sqlite:///{Path(__file__).resolve().parent.parent / 'data' / db_path}"
    
    # Check if engine needs initialization or reconstruction
    if _engine is None:
        connect_args = {}
        if db_url.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
            
            # Ensure folder containing SQLite file exists
            db_path = db_url.replace("sqlite:///", "")
            db_dir = os.path.dirname(db_path)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)
                
        _engine = create_engine(db_url, connect_args=connect_args)
        _SessionFactory = sessionmaker(autocommit=False, autoflush=False, bind=_engine)
        
    return _engine

def reset_db_engine():
    """Resets the engine and SessionFactory. Call this when database_url is updated in setup."""
    global _engine, _SessionFactory
    _engine = None
    _SessionFactory = None
    get_db_engine()

def get_db():
    get_db_engine()
    db = _SessionFactory()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    engine = get_db_engine()
    # Import models inside function to avoid circular imports
    import app.models
    Base.metadata.create_all(bind=engine)

