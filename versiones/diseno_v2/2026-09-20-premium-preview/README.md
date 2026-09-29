# Vista previa de diseño V2

Esta ejecución es una copia aislada para revisar la mejora visual sin modificar
ningún original. `baseline/original-sha256.txt` registra las fuentes protegidas
y `baseline/git-status.txt` conserva el estado local detectado al inicio.

## Abrir la vista previa

```bash
cd versiones/diseno_v2/2026-09-20-premium-preview/workspace/maquette_web
npm ci
VITE_E2E_PUBLIC_DIR=../../artefactos/catalogo npm exec vite -- --host 127.0.0.1 --port 4174
```

Abrir `http://127.0.0.1:4174/?vista=interior&maqueta=terraza_luz&piso=6&unidad=601`.
La marca `Vista previa V2` confirma que se trata de la copia aislada.

## Límites de esta ejecución

- No se publica ni se sustituye ningún modelo, manifiesto o código original.
- Los cambios se realizan solo bajo esta carpeta.
- Antes de revisar el resultado, ejecutar `scripts/verificar-originales.sh`.

