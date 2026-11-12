"""
Ejecutar UNA sola vez para crear el usuario admin (la ingeniera).
Desde la carpeta backend/: python crear_admin.py
"""
from database import SessionLocal, Base, engine, Usuario
from auth import hashear_password
from getpass import getpass
from pydantic import TypeAdapter, ValidationError
from schemas import Correo, Nombre, PasswordNueva

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    correo = TypeAdapter(Correo).validate_python(input("Correo de la ingeniera: "))
    nombre = TypeAdapter(Nombre).validate_python(input("Nombre completo: "))
    password = TypeAdapter(PasswordNueva).validate_python(getpass("Contraseña: "))
except ValidationError:
    raise SystemExit("Revisa el nombre, el correo y la contraseña. Usa al menos 12 caracteres y hasta 72 bytes.")

existente = db.query(Usuario).filter(Usuario.correo == correo).first()
if existente:
    print("Ya existe un usuario con ese correo.")
else:
    admin = Usuario(
        nombre_completo=nombre,
        correo=correo,
        password_hash=hashear_password(password),
        rol="admin",
        sede=None,
        activo=True,
    )
    db.add(admin)
    db.commit()
    print(f"Usuario admin '{correo}' creado con éxito.")

db.close()
