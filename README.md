# Akros - Sistema de Gestión

Este proyecto es una aplicación web para la gestión de un gimnasio de gimnasia artística. Está construido con React, Vite, Tailwind CSS y Firebase.

## Configuración Inicial de Firebase

1. Ingresá a la consola de Firebase (`console.firebase.google.com`) y creá un nuevo proyecto.
2. Habilitá **Authentication** y configurá el proveedor **Email/Password**.
3. Creá la base de datos **Firestore** en modo producción.
4. Habilitá **Firebase Storage** (si vas a requerir subida de imágenes para el apto o DNI - la URL actual usa strings que podés conectar con Storage agregando la librería y subiendo en la Ficha).
5. Las variables de retorno `.env` ya no son puramente necesarias si usas el `firebase-applet-config.json` inyectado por AI Studio que genera todo solo, pero si corrés local ponelas en el `.env`.

## Creación del primer Administrador (Manual)

1. En tu app, usá la pantalla de Registro para crear una cuenta (ej: `admin@gimnasio.com`). Esto creará la cuenta con rol `"padre"`.
2. Andá a la consola de Firebase -> Firestore Database.
3. Buscá la colección `usuarios`.
4. Encontrá tu documento (con el UID correspondiente a tu registro) y cambiá el campo `rol` de `"padre"` a `"admin"`.
5. Volvé a hacer login en la app y ya tendrás acceso al Panel de Administración.

## Ejecución

- Instalar dependencias: `npm install`
- Correr el entorno de desarrollo: `npm run dev`

## Cómo usar la carga masiva CSV
Andá a "Alumnas > Importar CSV".
Abrí el archivo adjunto `datos_ejemplo.csv`, copiá todo el contenido, pegalo en la caja de texto y procesá la importación.
Automáticamente se crearán las fichas de esas alumnas y las 12 cuotas anuales respectivas.
