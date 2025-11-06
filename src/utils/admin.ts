/**
 * Admin utilities
 */

const ADMIN_EMAILS = [
  'massiairbnb@gmail.com',
  'tmitchell.projets@gmail.com'
]

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
  const normalizedAdmins = ADMIN_EMAILS.map(email => email.toLowerCase().trim())
  const isAdminUser = normalizedAdmins.includes(normalizedInput)
  
  console.log('🔐 isAdmin check:', { 
    input: userEmail, 
    normalizedInput,
    adminEmails: ADMIN_EMAILS, 
    normalizedAdmins,
    match: isAdminUser,
    isAdmin: isAdminUser 
  })
  
  return isAdminUser
}

