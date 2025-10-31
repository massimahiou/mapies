/**
 * Admin utilities
 */

const ADMIN_EMAIL = 'massiairbnb@gmail.com'

/**
 * Check if a user email is an admin
 */
export const isAdmin = (userEmail: string | null | undefined): boolean => {
  console.log('🔐 isAdmin called with:', { userEmail, type: typeof userEmail })
  
  if (!userEmail) {
    console.log('🔐 isAdmin: No email provided')
    return false
  }
  
  const normalizedInput = userEmail.toLowerCase().trim()
  const normalizedAdmin = ADMIN_EMAIL.toLowerCase().trim()
  const isAdminUser = normalizedInput === normalizedAdmin
  
  console.log('🔐 isAdmin check:', { 
    input: userEmail, 
    normalizedInput,
    adminEmail: ADMIN_EMAIL, 
    normalizedAdmin,
    match: normalizedInput === normalizedAdmin,
    isAdmin: isAdminUser 
  })
  
  return isAdminUser
}

