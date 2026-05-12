import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { registerForPushNotifications } from "./lib/notifications";
import AuthScreen from "./screens/AuthScreen";
import CreateListingScreen from "./screens/CreateListingScreen";
import CorpHomeScreen from "./screens/CorpHomeScreen";
import NonprofitHomeScreen from "./screens/NonprofitHomeScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchUserRole(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchUserRole(session.user.id);
      else { setUserRole(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    const { data } = await supabase
      .from("users").select("role, organization_id").eq("id", userId).maybeSingle();
    setUserRole(data?.role || "admin");
    setLoading(false);
    registerForPushNotifications(userId);
  };

  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          userRole === "nonprofit" ? (
            <Stack.Screen name="NonprofitHome" component={NonprofitHomeScreen} />
          ) : (
            <Stack.Screen name="CorpHome" component={CorpHomeScreen} />
          )
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}