import { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Session } from "@supabase/supabase-js";
import { Alert } from "react-native";
import { supabase } from "./lib/supabase";
import { registerForPushNotifications } from "./lib/notifications";
import { TERMS_VERSION } from "./lib/terms";
import AuthScreen from "./screens/AuthScreen";
import CorpHomeScreen from "./screens/CorpHomeScreen";
import NonprofitHomeScreen from "./screens/NonprofitHomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import SettingsScreen from "./screens/SettingsScreen";
import TermsGate from "./components/TermsGate";

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [needsTerms, setNeedsTerms] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchUserProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) fetchUserProfile(session.user.id);
      else {
        setUserRole(null);
        setNeedsTerms(false);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data } = await supabase
      .from("users")
      .select("role, organization_id, banned, terms_accepted_at, terms_version")
      .eq("id", userId)
      .maybeSingle();

    if (data?.banned) {
      await supabase.auth.signOut();
      Alert.alert(
        "Account suspended",
        "This account has been suspended for violating our Terms of Use.",
      );
      setUserRole(null);
      setNeedsTerms(false);
      setLoading(false);
      return;
    }

    setUserRole(data?.role || "admin");
    const accepted =
      !!data?.terms_accepted_at && data?.terms_version === TERMS_VERSION;
    setNeedsTerms(!accepted);
    setLoading(false);
    registerForPushNotifications(userId);
  };

  if (loading) return null;

  if (session && needsTerms) {
    return (
      <TermsGate
        onAccepted={() => setNeedsTerms(false)}
      />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            {userRole === "nonprofit" ? (
              <Stack.Screen name="NonprofitHome" component={NonprofitHomeScreen} />
            ) : userRole === "admin" ? (
              <Stack.Screen name="CorpHome" component={CorpHomeScreen} />
            ) : (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            )}
            {(userRole === "admin" || userRole === "nonprofit") && (
              <Stack.Screen name="Settings" component={SettingsScreen} />
            )}
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
