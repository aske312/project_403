from fastapi import APIRouter

router = APIRouter()

@router.get("/api/debug/check")
def check_get():
    return {
        "status": "OK",
        "message": "GET is ok"
    }

@router.post("/api/debug/check")
def check_post():
    return {
        "status": "OK",
        "message": "POST is ok"
    }

@router.put("/api/debug/check")
def check_post():
    return {
        "status": "OK",
        "message": "PUT is ok"
    }

@router.patch("/api/debug/check")
def check_post():
    return {
        "status": "OK",
        "message": "PATCH is ok"
    }


@router.delete("/api/debug/check")
def check_post():
    return {
        "status": "OK",
        "message": "DELETE is ok"
    }
