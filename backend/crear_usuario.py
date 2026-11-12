"""
Crear un usuario nuevo (admin o Director de Carrera).
Desde la carpeta backend/: python crear_usuario.py
"""
from database import SessionLocal, Base, engine, Usuario
from auth import hashear_password
from getpass import getpass
from pydantic import TypeAdapter, ValidationError
from schemas import Correo, Nombre, PasswordNueva

Base.metadata.create_all(bind=engine)

db = SessionLocal()

print("Tipo de cuenta:")
print("  1 - Admin (Sistemas de Gestión)")
print("  2 - Usuario (Director/a de Carrera)")
tipo = input("Elegí 1 o 2: ").strip()
rol = "admin" if tipo == "1" else "usuario"

nombre = input("Nombre completo: ").strip()
correo = input("Correo institucional: ").strip()
try:
    correo = TypeAdapter(Correo).validate_python(correo)
    nombre = TypeAdapter(Nombre).validate_python(nombre)
    password = TypeAdapter(PasswordNueva).validate_python(getpass("Contraseña: "))
except ValidationError:
    raise SystemExit("Revisa el nombre, el correo y la contraseña. Usa al menos 12 caracteres y hasta 72 bytes.")

existente = db.query(Usuario).filter(Usuario.correo == correo).first()
if existente:
    print("Ya existe un usuario con ese correo.")
else:
    nuevo = Usuario(
        nombre_completo=nombre,
        correo=correo,
        password_hash=hashear_password(password),
        rol=rol,
        sede="El Alto" if rol == "usuario" else None,
        activo=True,
    )
    db.add(nuevo)
    db.commit()
    print(f"Usuario '{correo}' creado con éxito como {rol}.")

db.close()
