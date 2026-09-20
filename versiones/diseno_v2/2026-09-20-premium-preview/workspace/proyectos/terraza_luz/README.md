# Terraza Luz

Proyecto sintético creado a partir de una referencia visual isométrica. La distribución propone dos dormitorios, dos baños, cocina, lavandería, entrada, circulación, sala-comedor y una terraza ajardinada envolvente.

Todas las medidas, la planta sexta, la ubicación y el norte son supuestos de visualización. Antes de usar el estudio solar como información comercial deben reemplazarse las coordenadas, la orientación, la elevación y los obstáculos externos por datos verificados.

```bash
xixova validar -p proyectos/terraza_luz/proyecto.yaml --variante editorial_jardin
xixova preparar-maqueta -p proyectos/terraza_luz/proyecto.yaml --variante editorial_jardin --perfil premium
xixova hornear-maqueta -p proyectos/terraza_luz/proyecto.yaml --variante editorial_jardin --perfil premium --salida publicaciones/terraza_luz_premium
xixova exportar-maqueta -p proyectos/terraza_luz/proyecto.yaml --variante editorial_jardin --perfil premium --salida publicaciones/terraza_luz_premium
xixova auditar-maqueta -p proyectos/terraza_luz/proyecto.yaml --variante editorial_jardin --perfil premium --calidad-visual --compacto
xixova servir-maqueta -p proyectos/terraza_luz/proyecto.yaml --variante editorial_jardin --salida publicaciones/terraza_luz_premium
```

El perfil premium publica tres LOD, conserva materiales PBR y sustituye los
proxies en segundo plano. El paquete se bloquea por encima de 60 MB; la carga
inicial de la interfaz y los proxies debe permanecer bajo 8 MB. Los activos
Royalty Free nunca exponen su malla original y requieren un proxy web seguro.
