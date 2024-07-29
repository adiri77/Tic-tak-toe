use anchor_lang::prelude::*;

#[account]
pub struct ProgramState {
    pub current_version: u64,
    pub current_game_id: u64, // Use this to init next game
    pub bump: u8,
}
impl ProgramState {
    pub fn init(&mut self, bump: u8) {
        self.current_version = 1;
        self.current_game_id = 1;
        self.bump = bump;
    }
    pub fn increment_version(&mut self) {
        self.current_version += 1;
    }
    pub fn increment_game_id(&mut self) {
        self.current_game_id += 1;
    }
}