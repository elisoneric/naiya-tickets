
/**
 * ticketService.ts
 */
import * as storage from './storageService';
import * as emailService from './emailService';
import { Ticket, Message } from '../types';

export const createNewTicket = async (ticketData: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'messages' | 'ticketNumber' | 'status' | 'priority'>) => {
    const newTicket = await storage.createTicket(ticketData);
    return newTicket;
};

export const sendMessage = async (ticket: Ticket, messageData: Omit<Message, 'id' | 'timestamp'>) => {
    const responseStub = await storage.addMessageToTicket(ticket.id, messageData);
    
    // Auto-assign if not assigned and sender is staff/TL
    if (!ticket.assignedToEmail && (messageData.role === 'staff' || messageData.role === 'team_lead')) {
        await storage.assignTicket(ticket.id, messageData.senderId);
    }
    
    // 2. Trigger Email Notification (Non-blocking)
    const fullMessage = {
        ...messageData,
        id: 'temp',
        timestamp: new Date()
    } as Message;

    console.log('[TicketService] Triggering reply notification...');
    // Pass the full ticket object which contains metadata (email, title, etc)
    emailService.sendReplyNotification(ticket, fullMessage).catch(console.error);

    return responseStub;
};

export const escalate = async (ticket: Ticket) => {
    await storage.escalateTicket(ticket.id);
    // Send email to IT staff
    emailService.sendEscalationEmail(ticket).catch(console.error);
};

export const unassignTicket = async (ticketId: string) => {
    // Release the ticket by setting assignedToEmail to null
    // We also set user interaction lock to false
    await storage.assignTicket(ticketId, null);
};

export const changeStatus = storage.updateTicketStatus;
export const assignAgent = storage.assignTicket;

export const changeCategory = async (ticketId: string, category: string) => {
    await storage.updateTicket(ticketId, { category });
};

export const checkAgentAuthorized = async (email: string): Promise<boolean> => {
  const agent = await storage.getAgentRecord(email);
  return !!agent;
};
