import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Phone, Lock } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Logo } from '@shared/components/Logo';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { useAuth, useTranslation } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phone.length !== 10) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid 10-digit phone number',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(phone, password);
      setIsLoading(false);

      if (result.success) {
        if (result.role !== 'delivery') {
          toast({
            title: 'Access Denied',
            description: 'This portal is for delivery persons only. Please use the correct portal for your role.',
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'Login successful!',
          description: 'Redirecting to delivery dashboard...',
        });
        setTimeout(() => navigate('/'), 500);
      } else {
        toast({
          title: 'Login failed',
          description: result.error || 'Invalid phone number or password.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setIsLoading(false);
      toast({
        title: 'Login error',
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4 flex justify-between items-center">
        <Logo />
        <LanguageSelector />
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md card-shadow animate-slide-up">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">{t('deliveryDashboard')}</CardTitle>
            <CardDescription>
              Enter your phone number and password to access your delivery dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">{t('phone')}</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm font-medium">+91</span>
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="pl-20"
                    maxLength={10}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full water-gradient text-primary-foreground font-semibold"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : t('login')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
