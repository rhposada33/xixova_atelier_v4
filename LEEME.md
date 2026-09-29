> **Pipeline activo:** consulta [xixova/README.md](xixova/README.md) para crear apartamentos desde datos, separar arquitectura e interiorismo y generar recorridos. El contenido siguiente es documentación histórica y sus archivos están congelados en `legacy/produccion/`.

# Ajuste Atelier 4.0.2

Reemplaza SOLO atelier.py dentro de ~/RenderCasa/xixova_atelier_v4 con el de este paquete. Conserva recursos, caché y demás scripts.

## Primera prueba: exterior

```bash
cd "$HOME/RenderCasa/xixova_atelier_v4"
bash ejecutar.sh --modo previa --toma comedor
```

La panorámica usa ahora Generated en lugar de Normal para evitar la inversión observada. Se conserva el giro horizontal anterior para poder comparar. Revisa que el cielo quede arriba; la foto seguirá siendo una vista conceptual de Johannesburgo, no la vista real del XIXOVÁ. No se ha cambiado el HDRI ni se promete una composición concreta sin ver esta prueba.

Si ya está derecha pero aparecen demasiados tejados, compara otro giro:

```bash
bash ejecutar.sh --modo previa --toma comedor --giro-exterior 250
```

El giro solo cambia qué parte de la panorámica se ve. No corrige la inversión vertical: eso lo cambia el código. Conserva el valor que prefieras en las siguientes ejecuciones.

## Segunda prueba: sofá recto

El sofá anterior tiene chaise longue. Su reducción uniforme dejó una altura total de 0.48 m; no es una escala adecuada. Esta actualización NO convierte ni sustituye ese archivo de modelo. Para la sala necesitamos un recurso diferente.

En BlenderKit selecciona un sofá RECTO sin chaise longue, de aproximadamente 2.0–2.2 m de ancho, 0.80–0.95 m de fondo y 0.75–0.95 m de altura total. Busca un modelo de tela clara con cojines, costuras y materiales incluidos. Comprueba que su licencia y acceso permitan descargarlo en tu cuenta. No uses de nuevo White Sofa de ibotpl: es el modelo con chaise de la prueba anterior.

En una escena vacía importa solamente ese sofá y usa el exportador exportar_sofa.py que ya tienes. Como sofa.blend ya existe, el exportador guardará otro archivo con fecha: toma la ruta que muestra al terminar. Alternativamente usa File > External Data > Pack Resources y Save As para guardarlo como sofa_recto.blend.

Ejemplo si lo guardas con ese nombre:

```bash
bash ejecutar.sh --modo previa --toma ambas \
  --sofa "$HOME/RenderCasa/recursos_atelier/sofa_recto.blend"
```

Si usaste el exportador, reemplaza esa ruta por el nombre con fecha que te muestre.

Se conserva la escala uniforme. Si el ajuste deja menos de 1.90 m de ancho o menos de 0.65 m de altura total, la toma de sala se detiene con las dimensiones y una explicación. Eso significa que el recurso no se ajusta a esta propuesta, no que seleccionaste mal los objetos. La toma de comedor permite continuar con el sofá anterior para revisar el exterior; el informe indica que ese sofá no está validado para la sala.

## Iluminación y salidas

- Biblioteca: fuentes de 3 W a 1.2 W.
- Rebote de techo: 45 W a 22 W.
- Emisión de las tiras visibles: 2 a 0.7.
- Pasillo: plafón de 14 W, sujeto al multiplicador --luz-interior.
- Conserva cámaras, materiales, muros y configuración de muestras.
- El valor predeterminado de --toma ahora es comedor para que la primera prueba funcione con tus archivos actuales.

Comparte 02_comedor_atelier.png y el informe. Después de preparar el nuevo sofá, comparte también 01_sala_atelier.png. Cada ejecución crea su propia carpeta de resultados.

Validación: sintaxis Python comprobada y comprobaciones de escala revisadas con las medidas del informe anterior. No se pudo ejecutar Blender ni renderizar aquí. La orientación final de la panorámica y el efecto visual de las luces necesitan confirmarse en tu equipo. Esta entrega no incluye un nuevo modelo de sofá.
