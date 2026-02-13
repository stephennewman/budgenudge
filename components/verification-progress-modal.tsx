'use client';

interface VerificationProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export default function VerificationProgressModal({ 
  isOpen, 
  onClose, 
  userEmail 
}: VerificationProgressModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 0, 0, 0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        🎭 MODAL IS WORKING!<br/>
        Email: {userEmail}<br/>
        <button onClick={onClose} style={{marginTop: '20px', padding: '10px'}}>
          Close Modal
        </button>
      </div>
    </div>
  );
}