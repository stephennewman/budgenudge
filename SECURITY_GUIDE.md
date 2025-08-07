# Security Guide: User Data Isolation

This guide explains how to build and maintain Supabase with complete user data isolation, ensuring users cannot see each other's transactions or account balances.

## 🔒 Security Architecture Overview

### Multi-Layer Security Model

1. **Row Level Security (RLS)** - Database-level filtering
2. **Secure Functions** - Application-level validation
3. **Secure Views** - Pre-filtered data access
4. **API Route Validation** - Request-level security
5. **Authentication Middleware** - Session-level protection

## 🏗️ Database Security Implementation

### 1. Row Level Security Policies

All tables have RLS enabled with policies that filter by `user_id`:

```sql
-- Example: Users can only access their own items
CREATE POLICY "Users can only access their own items" ON items
  FOR ALL 
  USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );
```

### 2. Secure Functions

Functions with `SECURITY DEFINER` ensure proper user validation:

```sql
-- Example: Enhanced transaction function
CREATE OR REPLACE FUNCTION get_user_transactions(user_uuid UUID)
RETURNS TABLE (...)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT ... FROM transactions t
  INNER JOIN items i ON t.plaid_item_id = i.plaid_item_id
  WHERE i.user_id = user_uuid
    AND user_uuid = auth.uid()  -- Critical security check
    AND auth.uid() IS NOT NULL
$$;
```

### 3. Secure Views

Pre-filtered views that automatically enforce user isolation:

```sql
CREATE OR REPLACE VIEW user_transactions_secure AS
SELECT t.*, i.user_id
FROM transactions t
INNER JOIN items i ON t.plaid_item_id = i.plaid_item_id
WHERE i.user_id = auth.uid()
  AND auth.uid() IS NOT NULL;
```

## 🛡️ Application Security Implementation

### 1. Security Utilities

Use the security utilities in `utils/supabase/security.ts`:

```typescript
import { 
  getSecurityContext, 
  createSecureQuery, 
  requireAuth 
} from '@/utils/supabase/security';

// Get user context with item IDs
const context = await getSecurityContext();

// Create secure query builder
const secureQuery = await createSecureQuery();

// Use secure query methods
const { data } = await secureQuery
  .filterTransactionsByUser()
  .order('date', { ascending: false });
```

### 2. API Route Security

Always validate user access in API routes:

```typescript
export async function GET(request: Request) {
  try {
    // Method 1: Use security context
    const context = await getSecurityContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Method 2: Use secure query builder
    const secureQuery = await createSecureQuery();
    const { data } = await secureQuery
      .filterTransactionsByUser()
      .limit(50);

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### 3. Resource Validation

For specific resource access, use validation functions:

```typescript
import { validateTransactionAccess } from '@/utils/supabase/security';

// Validate access to specific transaction
const hasAccess = await validateTransactionAccess(transactionId);
if (!hasAccess) {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 });
}
```

## 🧪 Security Testing

### Running Security Tests

```bash
# Run the user isolation test script
node scripts/test-user-isolation.js
```

### What the Tests Verify

1. ✅ Users can access their own data
2. ❌ Users cannot access other users' data
3. ❌ Direct ID access is blocked
4. ❌ Secure functions prevent cross-user access
5. ❌ Secure views filter correctly
6. ❌ Account balances are isolated
7. ❌ Transaction history is isolated

### Manual Testing Checklist

- [ ] Create two test users
- [ ] Connect different bank accounts to each user
- [ ] Verify User A cannot see User B's transactions
- [ ] Verify User A cannot see User B's account balances
- [ ] Verify User A cannot access User B's data via API
- [ ] Verify User A cannot access User B's data via direct database queries

## 🔧 Maintenance and Updates

### When Adding New Tables

1. **Enable RLS**:
   ```sql
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   ```

2. **Create RLS Policy**:
   ```sql
   CREATE POLICY "Users can only access their own new_table" ON new_table
     FOR ALL 
     USING (
       user_id = auth.uid() 
       AND auth.uid() IS NOT NULL
     );
   ```

3. **Add to Security Utilities**:
   ```typescript
   // Add to utils/supabase/security.ts
   export async function getNewTableData() {
     const context = await getSecurityContext();
     if (!context) throw new Error('Authentication required');
     
     const supabase = await createSupabaseClient();
     return supabase
       .from('new_table')
       .select('*')
       .eq('user_id', context.userId);
   }
   ```

### When Adding New API Routes

1. **Always validate authentication**:
   ```typescript
   const context = await requireAuth();
   ```

2. **Use secure query methods**:
   ```typescript
   const secureQuery = await createSecureQuery();
   const { data } = await secureQuery.filterByUser();
   ```

3. **Validate specific resource access**:
   ```typescript
   const hasAccess = await validateResourceAccess(resourceId);
   if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
   ```

## 🚨 Security Best Practices

### Do's ✅

- Always use RLS policies on user data tables
- Use secure functions for data access
- Validate user authentication in all API routes
- Use the security utilities provided
- Test user isolation regularly
- Log security-related events
- Use parameterized queries
- Validate input data

### Don'ts ❌

- Never disable RLS on user data tables
- Don't trust client-side data
- Don't use direct database queries without user filtering
- Don't expose user IDs in URLs or responses
- Don't store sensitive data in client-side storage
- Don't bypass authentication checks
- Don't use string concatenation for SQL queries

## 🔍 Security Monitoring

### Logs to Monitor

1. **Authentication failures**
2. **RLS policy violations**
3. **Unauthorized access attempts**
4. **Cross-user data access attempts**
5. **API rate limiting violations**

### Security Alerts

Set up alerts for:
- Multiple failed login attempts
- Unusual data access patterns
- Cross-user data access attempts
- API endpoint abuse

## 📋 Security Checklist

### Database Security
- [ ] RLS enabled on all user data tables
- [ ] RLS policies properly configured
- [ ] Secure functions implemented
- [ ] Secure views created
- [ ] Permissions properly granted

### Application Security
- [ ] Authentication middleware active
- [ ] API routes validate user access
- [ ] Security utilities implemented
- [ ] Input validation in place
- [ ] Error handling doesn't leak data

### Testing Security
- [ ] User isolation tests pass
- [ ] Manual security testing completed
- [ ] Penetration testing performed
- [ ] Security audit completed

## 🆘 Troubleshooting

### Common Issues

1. **Users can see other users' data**
   - Check RLS policies are enabled
   - Verify RLS policies filter by `user_id`
   - Ensure `auth.uid()` is not null

2. **API routes returning unauthorized data**
   - Verify authentication is checked
   - Use secure query methods
   - Validate resource access

3. **Secure functions not working**
   - Check function permissions
   - Verify `SECURITY DEFINER` is set
   - Ensure user validation logic

### Debug Commands

```sql
-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';

-- Test user access
SELECT auth.uid() as current_user;
```

## 📞 Security Support

If you encounter security issues:

1. **Immediate Action**: Disable affected endpoints
2. **Investigation**: Review logs and audit trails
3. **Fix**: Implement proper security measures
4. **Test**: Run security tests
5. **Monitor**: Watch for similar issues

Remember: Security is an ongoing process, not a one-time setup!
