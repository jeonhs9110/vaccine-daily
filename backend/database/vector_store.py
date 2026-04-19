import os
import chromadb
import numpy as np
from sentence_transformers import SentenceTransformer


# Singleton instances
_chroma_client = None
_embed_model = None
_collection = None


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        mode = os.getenv("CHROMA_MODE", "local")

        # --- 1. 원격 서버 접속 모드 ---
        if mode == "remote":
            host = os.getenv("CHROMA_SERVER_HOST")
            port = os.getenv("CHROMA_SERVER_PORT", "8000")
            if not host:
                raise ValueError("CHROMA_MODE가 remote일 때는 CHROMA_SERVER_HOST가 필수입니다.")

            # print(f"--- [DEBUG] Connecting to Remote ChromaDB: {host}:{port} ---")
            _chroma_client = chromadb.HttpClient(host=host, port=int(port))

        # --- 2. 로컬 파일 모드 (Docker 또는 Local PC) ---
        else:
            # 현재 파일(vector_store.py 등)의 위치를 기준으로 backend 폴더 찾기
            # os.path.abspath(__file__) -> .../backend/utils/vector_store.py (예시)
            current_dir = os.path.dirname(os.path.abspath(__file__))

            if os.path.exists("/app"):
                # 도커 컨테이너 내부일 때
                CHROMA_PATH = "/app/backend/chroma_db"
            else:
                # 로컬 환경 (VaccineDailyReport/backend/...)
                # 현재 파일이 backend 폴더 안에 있다면, 그 위치에 chroma_db를 생성
                # 만약 utils 폴더 안에 있다면 한 단계 위로 올라가야 함
                BASE_DIR = os.path.dirname(current_dir) if "utils" in current_dir else current_dir
                CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")

            os.makedirs(CHROMA_PATH, exist_ok=True)
            # print(f"--- [DEBUG] Using Local ChromaDB Path: {CHROMA_PATH} ---")
            _chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)

    return _chroma_client


def get_embed_model():
    global _embed_model
    if _embed_model is None:
        print("--- [VectorStore] Loading SentenceTransformer Model... ---")
        _embed_model = SentenceTransformer("jhgan/ko-sroberta-multitask")
    return _embed_model


def get_collection():
    global _collection
    if _collection is None:
        client = get_chroma_client()
        _collection = client.get_or_create_collection(name="news_articles_ko", metadata={"hnsw:space": "cosine"})
    return _collection


def encode_texts(texts: list[str]) -> np.ndarray:
    """
    Generate embeddings for a list of texts using the shared model.
    """
    model = get_embed_model()
    # normalize_embeddings=True is important for cosine similarity
    return model.encode(texts, normalize_embeddings=True)
