import InPageSidebar from "@/components/in-page-sidebar";
import { createSupabaseClient } from "@/utils/supabase/server";
import { isSuperAdmin } from "@/utils/auth/superadmin";
import { getProtectedNavItems } from "@/components/protected-nav-items";

export default async function ProtectedSidebar() {
  // Check if current user is superadmin to show Feed
  let isUserSuperAdmin = false;
  try {
    const supabase = await createSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    isUserSuperAdmin = user ? isSuperAdmin(user.id) : false;
  } catch (error) {
    console.error('Error checking superadmin status:', error);
  }

  const items = getProtectedNavItems(isUserSuperAdmin);

  return (
    <div className="hidden lg:block">
      <InPageSidebar
        basePath="/protected"
        items={items}
      />
    </div>
  );
}
