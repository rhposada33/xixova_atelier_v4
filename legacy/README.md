# Código histórico

`produccion/` contiene el pipeline anterior, sus escenas de trabajo y sus salidas. Se conserva para reproducir y comparar XIXOVÁ, pero no recibe funcionalidades nuevas.

El único desarrollo activo es `xixova/`. Los comandos antiguos aún pueden ejecutarse cambiando el prefijo documentado originalmente:

```bash
bash legacy/produccion/xixova.sh pipeline validar
```

Las rutas internas continúan siendo relativas a `legacy/produccion/`, por lo que mover la carpeta no altera sus escenas ni configuraciones. No usar este pipeline para proyectos nuevos.
