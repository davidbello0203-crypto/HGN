# Good Nutrition Habits — Memory

## Proyecto
- **Ruta:** /Users/davidbello/good-nutrition-habits
- **Stack:** Next.js 16 + TypeScript + TailwindCSS + Framer Motion + Lucide React
- **Deploy:** pendiente (Vercel recomendado)

## Cliente
- **Marca:** GOOD NUTRITION HABITS
- **Nutriólogo:** L.N. Bryan Yaudiel Gil Tlatempa
- **Ciudad:** Tixtla de Guerrero, México
- **WhatsApp:** 745 110 5266 → `https://wa.me/527451105266`
- **Instagram:** @good_nutrition_habits

## Diseño — Titanium Elite
- Fondo: `#080808` / Cards: `#1C1C1E` / Bordes: `#2A2A2A`
- Plata: `#E8E8E8` / Dorado titanio: `#A89060` / Texto muted: `#8D8D8D`
- Fuentes: Playfair Display (headings) + Inter (cuerpo)
- Clases utilitarias: `.text-gradient`, `.card-hover`, `.gold-border`

## Estructura de archivos
```
src/
  app/
    globals.css      ← tema Titanium Elite
    layout.tsx       ← fonts + metadata SEO
    page.tsx         ← composición de secciones
  components/
    Navbar.tsx       ✅ sticky, mobile menu, scroll effect
    Hero.tsx         ✅ parallax orbs, heading, CTAs, social links
    Services.tsx     ✅ 6 cards con iconos
    About.tsx        ✅ placeholder foto + stats grid
    Schedule.tsx     ✅ tabla horarios Lun-Vie 6am-6pm
    BookingCTA.tsx   ✅ WhatsApp + Instagram cards
    Footer.tsx       ✅ branding + contacto + nav
```

## Estado de tareas (Fase 1 — Landing)
- ✅ Hero section premium con CTA fuerte
- ✅ Sección de servicios (Nutrición + Entrenamiento)
- ✅ Sección "Sobre mí"
- ✅ Navbar responsive con branding
- ✅ Paleta de colores y tipografía premium definida
- ✅ Footer completo con contacto y redes
- ⬜ Testimonios / Resultados de clientes
- ⬜ Galería o antes/después
- ⬜ Precios de planes
- ⬜ Foto real del nutriólogo (placeholder activo)

## Pendiente inmediato
- Foto real de Bryan para la sección About
- Testimonios de clientes reales
- Precios de planes
- Deploy en Vercel
