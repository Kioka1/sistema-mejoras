"""
Crear un usuario nuevo (admin o Director de Carrera).
Desde la carpeta backend/: python crear_usuario.py
"""
from database import SessionLocal, Base, engine, Usuario
from auth import hashear_password

Base.metadata.create_all(bind=engine)

db = SessionLocal()

print("Tipo de cuenta:")
print("  1 - Admin (Sistemas de Gestión)")
print("  2 - Usuario (Director/a de Carrera)")
tipo = input("Elegí 1 o 2: ").strip()
rol = "admin" if tipo == "1" else "usuario"

nombre = input("Nombre completo: ").strip()
correo = input("Correo institucional: ").strip()
password = input("Contraseña: ").strip()

sede = ""
if rol == "usuario":
    sede = input("Sede (El Alto / Cochabamba / Santa Cruz / La Paz): ").strip()

existente = db.query(Usuario).filter(Usuario.correo == correo).first()
if existente:
    print("Ya existe un usuario con ese correo.")
else:
    nuevo = Usuario(
        nombre_completo=nombre,
        correo=correo,
        password_hash=hashear_password(password),
        rol=rol,
        sede=sede if rol == "usuario" else None,
        activo=True,
    )
    db.add(nuevo)
    db.commit()
    print(f"Usuario '{correo}' creado con éxito como {rol}.")

db.close()