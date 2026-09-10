# Terraza Luz

Proyecto sintético creado a partir de una referencia visual isométrica. La distribución propone dos dormitorios, dos baños, cocina, lavandería, entrada, circulación, sala-comedor y una terraza ajardinada envolvente.

Todas las medidas, la planta sexta, la ubicación y el norte son supuestos de visualización. Antes de usar el estudio solar como información comercial deben reemplazarse las coordenadas, la orientación, la elevación y los obstáculos externos por datos verificados.

```bash
xixova validar -p proyectos/terraza_luz/proyecto.yaml --variante editorial_jardin
xixova exportar-maqueta -p proyectos/terraza_luz/proyecto.yaml --variante editorial_jardin --salida publicaciones/terraza_luz
xixova servir-maqueta -p proyectos/terraza_luz/proyecto.yaml --variante editorial_jardin --salida publicaciones/terraza_luz
```
