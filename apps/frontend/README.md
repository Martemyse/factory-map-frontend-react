# Factory Map Dashboard

A modern, interactive factory mapping and monitoring application built with React, TypeScript, and Deck.gl. This application provides real-time visualization of factory locations, production metrics, and operational status across multiple facilities.

![Factory Map Dashboard](https://img.shields.io/badge/React-19.1.1-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue) ![Deck.gl](https://img.shields.io/badge/Deck.gl-9.1.14-green) ![Vite](https://img.shields.io/badge/Vite-7.1.2-purple)

## 🚀 Features

- **Interactive Map Visualization**: Real-time factory locations with Deck.gl and MapLibre GL
- **Production Monitoring**: Live production metrics and efficiency tracking
- **Advanced Filtering**: Filter factories by status, capacity, and efficiency ranges
- **Detailed Factory Views**: Comprehensive factory information and production line details
- **Responsive Design**: Mobile-friendly interface with adaptive layouts
- **Real-time Data**: Mock data simulation with realistic factory metrics
- **Modern UI/UX**: Clean, professional interface with smooth animations

## 🛠️ Tech Stack

- **Frontend**: React 19.1.1 with TypeScript 5.8.3
- **Build Tool**: Vite 7.1.2
- **Mapping**: Deck.gl 9.1.14, MapLibre GL 5.7.1
- **State Management**: React Hooks, Zustand 5.0.8
- **Forms**: React Hook Form 7.62.0 with Zod 4.1.8 validation
- **Canvas**: MapLibre GL for interactive mapping
- **Styling**: CSS3 with modern flexbox/grid layouts
- **Linting**: ESLint 9.33.0 with TypeScript support

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Martemyse/factory-map-frontend-react.git
   cd factory-map-frontend-react
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

## 🏗️ Project Structure

```
src/
├── components/           # React components
│   ├── Map/             # Map-related components
│   │   ├── DeckGLMap.tsx
│   │   └── MapContainer.tsx
│   ├── FactoryPanel/    # Factory detail panels
│   │   ├── FactoryDetails.tsx
│   │   └── FactoryPanel.tsx
│   └── Controls/        # UI controls
│       ├── MapControls.tsx
│       └── FilterPanel.tsx
├── hooks/               # Custom React hooks
│   └── useMapState.ts
├── data/                # Mock data and API
│   └── mockData.ts
├── types/               # TypeScript type definitions
│   └── index.ts
├── App.tsx              # Main application component
├── App.css              # Application styles
└── main.tsx             # Application entry point
```

## 🎯 Key Components

### Map Visualization
- **DeckGLMap**: Interactive map with factory markers and heatmap overlay
- **MapContainer**: Wrapper component for map functionality
- **MapControls**: Zoom, pan, and reset controls

### Factory Management
- **FactoryPanel**: Detailed factory information sidebar
- **FactoryDetails**: Production metrics and status display
- **FilterPanel**: Advanced filtering and search capabilities

### Data Management
- **useMapState**: Custom hook for map state management
- **Mock Data**: Realistic factory and production line data
- **TypeScript Types**: Comprehensive type definitions

## 🚀 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

## 🎨 Features in Detail

### Interactive Mapping
- Click on factory markers to view detailed information
- Hover for quick tooltips with key metrics
- Heatmap visualization showing production density
- Smooth zoom and pan controls

### Production Monitoring
- Real-time production metrics
- Efficiency calculations and visual indicators
- Production line status tracking
- Capacity utilization monitoring

### Advanced Filtering
- Filter by factory status (Active, Maintenance, Inactive)
- Efficiency range filtering (0-100%)
- Capacity range filtering
- Real-time filter application

### Responsive Design
- Mobile-first approach
- Adaptive layouts for different screen sizes
- Touch-friendly controls
- Optimized for tablets and desktops

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:
```env
VITE_MAPBOX_TOKEN=your_mapbox_token_here
VITE_API_BASE_URL=http://localhost:3000/api
```

### Map Configuration
The application uses MapLibre GL for map rendering. You can customize the map style and configuration in the `DeckGLMap` component.

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Martin Misson**
- GitHub: [@martinmi](https://github.com/martinmi)
- Portfolio: [Your Portfolio URL]
- LinkedIn: [Your LinkedIn URL]

## 🙏 Acknowledgments

- [Deck.gl](https://deck.gl/) for powerful data visualization
- [MapLibre GL](https://maplibre.org/) for open-source mapping
- [React](https://react.dev/) for the amazing UI framework
- [Vite](https://vitejs.dev/) for the lightning-fast build tool

## 📈 Roadmap

- [ ] Real-time data integration
- [ ] User authentication and roles
- [ ] Advanced analytics dashboard
- [ ] Mobile app development
- [ ] API integration for live data
- [ ] Export functionality for reports
- [ ] Dark mode theme
- [ ] Multi-language support

---

⭐ **Star this repository if you found it helpful!**
