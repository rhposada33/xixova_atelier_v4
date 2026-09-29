# Simulación solar de Xixova Maqueta

La simulación combina una posición solar astronómica con una iluminación adaptada para presentación inmobiliaria. `SolarEngine` calcula eventos y dirección; el adaptador Three.js controla la luz; `SunlightAnalyzer` mide incidencia mediante rayos; React sólo presenta y modifica el estado.

## Configurar un proyecto

La configuración vive en `presentacion.yaml`, dentro de `maqueta.solar`. Requiere latitud y longitud verificadas, zona horaria IANA y orientación del modelo. Puede obtener coordenadas mediante un levantamiento o servicio cartográfico y la zona en la base IANA. Mientras alguno de estos datos sea provisional, use `calibrationStatus: demo_unverified`; la interfaz mostrará que es una estimación.

Xixova usa metros, planta en XY y altura en Z. Con offset cero, +Y es norte y +X es este. `northOffsetDegrees` es la rotación horaria, vista desde +Z, que lleva +Y al norte verdadero. Para calibrarlo, identifique una arista en un plano georreferenciado, mida su rumbo y compruebe manualmente una sombra en mañana y tarde.

```yaml
maqueta:
  solar:
    enabled: true
    calibrationStatus: verified
    location: {latitude: 40.4168, longitude: -3.7038, timezone: Europe/Madrid}
    building: {northOffsetDegrees: 18, groundElevationMeters: 657}
    unit: {floorNumber: 4, elevationMeters: 12}
    exposureThreshold: 0.2
    environment:
      obstacles:
        - id: edificio_oeste
          type: box
          category: external_structure
          position: [-12, 3, 9]
          dimensions: [8, 16, 18]
          rotationDegrees: 5
        - id: arbol_sur
          type: cylinder
          category: vegetation
          position: [3, -8, 4]
          dimensions: [4, 4, 8]
```

Este ejemplo ficticio del hemisferio norte demuestra que el motor no depende de Garden House. Los accesos de verano e invierno se invierten automáticamente según la latitud.

## Habitaciones, muestras y obstáculos

El exportador genera muestras dentro de cada polígono a 0,15 m, 0,80 m y 1,40 m. Un espacio puede sustituirlas con `muestras_solares` en su contrato arquitectónico. Conviene ubicarlas donde se desea evaluar piso, superficies de trabajo y altura humana, siempre dentro del recinto.

Las paredes respetan huecos de puertas y ventanas. Las cubiertas de espacios marcados como cubiertos y los obstáculos `box`, `cylinder` o `wall` bloquean rayos. Un árbol sólido da una estimación conservadora; esta versión no modela transparencia ni cambio estacional del follaje. El mobiliario no bloquea el cálculo por defecto.

## Precisión y verificación

La dirección del sol depende de datos reales; color, intensidad y ambiente son artísticos. El resultado no reemplaza un estudio normativo. Edificios vecinos ausentes, geometría simplificada, ventanas imprecisas y un norte provisional reducen la fidelidad.

Antes de publicar como configuración verificada, compare salida, mediodía y puesta con una herramienta solar independiente y con fotografías o sombras medidas en el inmueble. Confirme también horario de verano en fechas históricas. Mejoras futuras pueden incorporar mallas urbanas, BVH para escenas extensas, translucidez de vegetación y acumulados de horas de sol.
