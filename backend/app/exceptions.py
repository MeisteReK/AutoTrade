"""
Klasy wyjątków dla aplikacji AutoTrade Analytics.
"""

from fastapi import HTTPException, status
from typing import Optional, Any, Dict


class AutoTradeException(HTTPException):
    """Bazowa klasa wyjątków."""
    
    def __init__(
        self,
        status_code: int,
        detail: str,
        headers: Optional[Dict[str, Any]] = None,
        error_code: Optional[str] = None
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.error_code = error_code or self.__class__.__name__


class ValidationError(AutoTradeException):
    """Błąd walidacji danych wejściowych."""
    
    def __init__(self, detail: str, field: Optional[str] = None):
        message = f"Błąd walidacji: {detail}"
        if field:
            message = f"Błąd walidacji pola '{field}': {detail}"
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
            error_code="VALIDATION_ERROR"
        )


class AuthenticationError(AutoTradeException):
    """Błąd autentykacji."""
    
    def __init__(self, detail: str = "Nieprawidłowe dane logowania"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
            error_code="AUTHENTICATION_ERROR"
        )


class AuthorizationError(AutoTradeException):
    """Błąd autoryzacji - brak uprawnień."""
    
    def __init__(self, detail: str = "Brak uprawnień do wykonania tej operacji"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code="AUTHORIZATION_ERROR"
        )


class NotFoundError(AutoTradeException):
    """Zasób nie został znaleziony."""
    
    def __init__(self, resource: str = "Zasób", resource_id: Optional[Any] = None):
        if resource_id:
            detail = f"{resource} o ID {resource_id} nie został znaleziony"
        else:
            detail = f"{resource} nie został znaleziony"
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code="NOT_FOUND"
        )


class ConflictError(AutoTradeException):
    """Konflikt - zasób już istnieje lub jest w użyciu."""
    
    def __init__(self, detail: str = "Zasób już istnieje lub jest w użyciu"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            error_code="CONFLICT"
        )


class DatabaseError(AutoTradeException):
    """Błąd bazy danych."""
    
    def __init__(self, detail: str = "Wystąpił błąd bazy danych"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="DATABASE_ERROR"
        )


class ExternalServiceError(AutoTradeException):
    """Błąd zewnętrznego serwisu."""
    
    def __init__(self, service: str, detail: Optional[str] = None):
        message = f"Błąd serwisu {service}"
        if detail:
            message = f"{message}: {detail}"
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=message,
            error_code="EXTERNAL_SERVICE_ERROR"
        )


class ModelTrainingError(AutoTradeException):
    """Błąd podczas treningu modelu ML."""
    
    def __init__(self, detail: str = "Wystąpił błąd podczas treningu modelu"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="MODEL_TRAINING_ERROR"
        )


class DataProcessingError(AutoTradeException):
    """Błąd podczas przetwarzania danych."""
    
    def __init__(self, detail: str = "Wystąpił błąd podczas przetwarzania danych"):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail,
            error_code="DATA_PROCESSING_ERROR"
        )

