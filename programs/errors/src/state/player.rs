use anchor_lang::prelude::*;

#[account]
pub struct Player {
    auth: Pubkey,
    pub record: Record,
    pub airdrop_received: bool,
    pub reward_claimed: bool,
    pub bump: u8,
}

impl Player {
    pub fn calculate_account_space() -> usize {
        8 +                                     // discriminator
        32 +                                    // key
        Record::calculate_account_space() +     // record
        1 +                                     // airdrop received
        1 +                                     // reward_claimed
        1                                       // bump
    }

    pub fn init(&mut self, player: Pubkey, bump: u8) {
        self.auth = player;
        self.record = Record::default();
        self.reward_claimed = false;
        self.bump = bump;
    }

    pub fn record_win(&mut self) {
        self.record.wins += 1
    }
    pub fn record_lose(&mut self) {
        self.record.losses += 1
    }
    pub fn record_tie(&mut self) {
        self.record.ties += 1
    }
    pub fn claim_reward(&mut self) {
        self.reward_claimed = true
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct Record {
    pub wins: u8,
    losses: u8,
    ties: u8,
}

impl Record {
    pub fn calculate_account_space() -> usize {
        1 + // wins
        1 + // losses
        1 // ties
    }
    pub fn default() -> Self {
        Record {
            wins: 0,
            losses: 0,
            ties: 0,
        }
    }
}