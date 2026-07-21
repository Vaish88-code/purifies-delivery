import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@shared/components/ui/button";
import { Card, CardContent } from "@shared/components/ui/card";
import { Logo } from "@shared/components/Logo";
import { LanguageSelector } from "@shared/components/LanguageSelector";
import { 
  Droplets, 
  Truck, 
  MapPin, 
  Phone,
  Navigation,
  Calendar,
  IndianRupee,
  Bike,
  Route,
  Users,
  Building2,
  ShieldCheck,
  Clock,
  BadgeCheck,
  Languages,
  ArrowRight,
  Check,
  X,
  ChevronDown,
  BarChart3,
  Zap,
  Gift
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0 }
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 }
};

const slideInLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0 }
};

const slideInRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0 }
};

const heroImages: string[] = [
  "/hero/images/home.png",
  "/hero/images/delivery.png.png",
  "/hero/images/shopwater.png.png",
  "/hero/images/transport.png",
  "/hero/images/water.png",
];

const LandingPage = () => {
  const [currentHeroImage, setCurrentHeroImage] = useState(0);

  useEffect(() => {
    if (heroImages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentHeroImage((prev) => (prev + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border"
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection('features')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</button>
            <button onClick={() => scrollToSection('how-it-works')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it Works</button>
            <button onClick={() => scrollToSection('trust')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Why Trust Us</button>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            <Link to="/login">
              <Button size="sm" className="water-gradient text-primary-foreground">Login</Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative mt-16 pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden min-h-[calc(100vh-4rem)]">
        <div className="absolute inset-0 overflow-hidden">
          {heroImages.map((src, index) => (
            <motion.img
              key={src}
              src={src}
              alt="Purifies delivery partner visual"
              className="absolute inset-0 h-full w-full object-cover object-center"
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{
                opacity: currentHeroImage === index ? 1 : 0,
                scale: currentHeroImage === index ? 1 : 1.02,
              }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/60 to-black/40 pointer-events-none" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6"
              >
                <Bike className="w-4 h-4" />
                Join Our Delivery Fleet
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
              >
                <span className="hero-heading-gradient">
                  Deliver Water, Earn Daily.
                </span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-xl mx-auto lg:mx-0"
              >
                Pick up deliveries, navigate to customers, earn per delivery + tips — with real-time admin payouts directly to your UPI.
              </motion.p>
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Link to="/login">
                  <Button size="lg" className="water-gradient text-primary-foreground w-full sm:w-auto text-lg px-8">
                    Start Delivering
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8">
                    Login
                  </Button>
                </Link>
              </motion.div>
            </div>

            <div className="hidden lg:block" />
          </div>

          {/* Scroll Indicator */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="flex justify-center mt-16"
          >
            <button 
              onClick={() => scrollToSection('what-is-purifies')}
              className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="text-sm">Learn More</span>
              <ChevronDown className="w-5 h-5 animate-bounce" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* What is Purifies Delivery */}
      <section id="what-is-purifies" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              What is <span className="water-gradient-text">Purifies Delivery</span>?
            </h2>
            <p className="text-lg text-muted-foreground">
              Purifies Delivery is the partner app for delivery personnel. Get assigned orders from admin, navigate to customers, mark deliveries complete, and earn money — all from your phone.
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            {[
              { icon: Truck, label: "Accept Deliveries", desc: "Get assigned orders in real-time" },
              { icon: Navigation, label: "GPS Navigation", desc: "Turn-by-turn route to customers" },
              { icon: IndianRupee, label: "Earn Per Delivery", desc: "Base pay + per km + tips" },
              { icon: BarChart3, label: "Track Earnings", desc: "Daily/weekly analytics" },
            ].map((item, index) => (
              <motion.div key={index} variants={scaleIn} transition={{ duration: 0.5 }}>
                <Card className="text-center p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50">
                  <CardContent className="p-0">
                    <div className="w-16 h-16 rounded-2xl water-gradient flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h3 className="font-semibold mb-1">{item.label}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Why Purifies Delivery */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why <span className="water-gradient-text">Purifies Delivery</span>?
            </h2>
            <p className="text-lg text-muted-foreground">
              Say goodbye to confusing delivery jobs
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={slideInLeft}
              transition={{ duration: 0.6 }}
            >
              <Card className="p-8 bg-destructive/5 border-destructive/20 h-full">
                <h3 className="text-xl font-bold text-destructive mb-6 flex items-center gap-2">
                  <X className="w-6 h-6" />
                  The Old Way
                </h3>
                <ul className="space-y-4">
                  {[
                    "No clear delivery assignments",
                    "No route guidance to customer",
                    "Manual cash collection & tracking",
                    "No transparency on earnings",
                    "Delayed or missing payments",
                  ].map((problem, index) => (
                    <motion.li 
                      key={index} 
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <X className="w-4 h-4 text-destructive" />
                      </div>
                      <span className="text-muted-foreground">{problem}</span>
                    </motion.li>
                  ))}
                </ul>
              </Card>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              variants={slideInRight}
              transition={{ duration: 0.6 }}
            >
              <Card className="p-8 bg-secondary/5 border-secondary/20 h-full">
                <h3 className="text-xl font-bold text-secondary mb-6 flex items-center gap-2">
                  <Check className="w-6 h-6" />
                  The Purifies Way
                </h3>
                <ul className="space-y-4">
                  {[
                    "Clear order assignments from admin",
                    "Built-in map navigation to customer",
                    "Automatic earning calculation per trip",
                    "Real-time earnings dashboard & analytics",
                    "Direct UPI transfers by admin — no withdrawal needed",
                  ].map((solution, index) => (
                    <motion.li 
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-4 h-4 text-secondary" />
                      </div>
                      <span className="text-foreground font-medium">{solution}</span>
                    </motion.li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How It <span className="water-gradient-text">Works</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Start earning in 4 simple steps
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto"
          >
            {[
              { icon: Phone, step: "01", title: "Login", desc: "Sign in with your registered phone number" },
              { icon: Truck, step: "02", title: "Get Orders", desc: "Receive delivery assignments from admin" },
              { icon: Navigation, step: "03", title: "Navigate & Deliver", desc: "Follow GPS route and deliver water jars" },
              { icon: IndianRupee, step: "04", title: "Get Paid", desc: "Admin transfers earnings directly to your UPI" },
            ].map((item, index) => (
              <motion.div 
                key={index} 
                variants={fadeInUp}
                transition={{ duration: 0.5 }}
                className="relative text-center"
              >
                {index < 3 && (
                  <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/30 to-primary/10" />
                )}
                
                <div className="relative z-10">
                  <motion.div 
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="w-24 h-24 rounded-3xl water-gradient flex items-center justify-center mx-auto mb-4 shadow-lg"
                  >
                    <item.icon className="w-10 h-10 text-primary-foreground" />
                  </motion.div>
                  <div className="text-xs font-bold text-primary mb-2">STEP {item.step}</div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Key Features */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Key <span className="water-gradient-text">Features</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Everything you need for efficient water delivery
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            {[
              { icon: MapPin, title: "Live Order Tracking", desc: "See your assigned orders on an interactive map" },
              { icon: Route, title: "Smart Navigation", desc: "One-tap Google Maps navigation to every customer" },
              { icon: IndianRupee, title: "Earnings Analytics", desc: "Daily, weekly charts showing your transfer history from admin" },
              { icon: Gift, title: "Weekly Bonuses", desc: "Complete milestone deliveries for extra bonus rewards" },
              { icon: Zap, title: "Surge Pay", desc: "Earn extra during peak delivery hours" },
              { icon: Languages, title: "Multi-Language", desc: "Use the app in English, Hindi, Marathi, or Kannada" },
            ].map((feature, index) => (
              <motion.div key={index} variants={scaleIn} transition={{ duration: 0.5 }}>
                <Card className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group border-border/50 h-full">
                  <CardContent className="p-0">
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-4"
                    >
                      <feature.icon className="w-7 h-7 text-primary" />
                    </motion.div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Who Can Use */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Who Can Use <span className="water-gradient-text">Purifies Delivery</span>?
            </h2>
            <p className="text-lg text-muted-foreground">
              Perfect for anyone looking to earn through delivery
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-5xl mx-auto"
          >
            {[
              { icon: Bike, label: "Bike Riders" },
              { icon: Truck, label: "Tempo Drivers" },
              { icon: Users, label: "Part-time Workers" },
              { icon: Building2, label: "Full-time Drivers" },
              { icon: Droplets, label: "Water Delivery Boys" },
            ].map((item, index) => (
              <motion.div key={index} variants={scaleIn} transition={{ duration: 0.5 }}>
                <Card className="p-6 text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50">
                  <CardContent className="p-0">
                    <motion.div 
                      whileHover={{ scale: 1.1 }}
                      className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4"
                    >
                      <item.icon className="w-8 h-8 text-primary" />
                    </motion.div>
                    <h3 className="font-semibold">{item.label}</h3>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Trust Section */}
      <section id="trust" className="py-20">
        <div className="container mx-auto px-4">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeInUp}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Trust <span className="water-gradient-text">Purifies</span>?
            </h2>
            <p className="text-lg text-muted-foreground">
              Built for delivery partners' success
            </p>
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="grid md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-5xl mx-auto"
          >
            {[
              { icon: BadgeCheck, label: "Fair Pay Rates", color: "bg-primary" },
              { icon: IndianRupee, label: "Direct UPI Pay", color: "bg-secondary" },
              { icon: Clock, label: "Flexible Hours", color: "bg-primary" },
              { icon: ShieldCheck, label: "Secure App", color: "bg-secondary" },
              { icon: Languages, label: "Local Language", color: "bg-primary" },
            ].map((item, index) => (
              <motion.div 
                key={index} 
                variants={scaleIn} 
                transition={{ duration: 0.5 }}
                className="text-center"
              >
                <motion.div 
                  whileHover={{ scale: 1.1, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className={`w-20 h-20 rounded-full ${item.color} flex items-center justify-center mx-auto mb-4 shadow-lg`}
                >
                  <item.icon className="w-10 h-10 text-primary-foreground" />
                </motion.div>
                <h3 className="font-semibold">{item.label}</h3>
              </motion.div>
            ))}
          </motion.div>

          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={fadeIn}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4 mt-12"
          >
            {["100% Tips to You", "Daily Earnings Dashboard", "Weekly Bonuses", "15+ Cities"].map((badge, index) => (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="px-6 py-3 rounded-full bg-accent text-accent-foreground font-medium"
              >
                {badge}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 water-gradient opacity-90" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          transition={{ duration: 0.6 }}
          className="container mx-auto px-4 relative z-10 text-center"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
            Start Earning as a Delivery Partner
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Join the Purifies delivery fleet and earn money delivering water to homes and businesses
          </p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/login">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto text-lg px-8">
                Start Delivering
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <motion.footer 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={fadeIn}
        transition={{ duration: 0.6 }}
        className="py-12 bg-card border-t border-border"
      >
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <Logo size="md" />
              <p className="text-muted-foreground mt-4 max-w-md">
                Purifies Delivery — earn money delivering pure water to customers. Fair pay, real-time tracking, and direct admin payouts.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li><button onClick={() => scrollToSection('what-is-purifies')} className="text-muted-foreground hover:text-foreground transition-colors">About</button></li>
                <li><button onClick={() => scrollToSection('how-it-works')} className="text-muted-foreground hover:text-foreground transition-colors">How it Works</button></li>
                <li><button onClick={() => scrollToSection('features')} className="text-muted-foreground hover:text-foreground transition-colors">Features</button></li>
                <li><button onClick={() => scrollToSection('trust')} className="text-muted-foreground hover:text-foreground transition-colors">Contact</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Get Started</h4>
              <ul className="space-y-2">
                <li><Link to="/login" className="text-muted-foreground hover:text-foreground transition-colors">Login</Link></li>
              </ul>
              <div className="mt-4">
                <LanguageSelector />
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 Purifies. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Made with 💧 for India
            </p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
};

export default LandingPage;
