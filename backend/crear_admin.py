"""
Ejecutar UNA sola vez para crear el usuario admin (la ingeniera).
Desde la carpeta backend/: python crear_admin.py
"""
from database import SessionLocal, Base, engine, Usuario
from auth import hashear_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

correo = input("Correo de la ingeniera: ").strip()
nombre = input("Nombre completo: ").strip()
password = input("Contraseña: ").strip()

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