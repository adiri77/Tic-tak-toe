use anchor_lang::prelude::*;
use instructions::*;
use state::game::Square;
pub mod errors;
pub mod instructions;
pub mod state;

declare_id!("CTfJP2WRXfSVMmaQ4Mdn78oAhNHnQPj8cM22dwY5PsyN");

#[program]
pub mod quick_tac_toe {
    // 👈 Replace with your program name
    use super::*;

    // 1. Create a New Token Mint for Playing the Game
    pub fn init(ctx: Context<Init>) -> Result<()> {
        instructions::init::init(ctx)
    }

    // 2. Init New Player Account
    pub fn create_player(ctx: Context<CreatePlayer>) -> Result<()> {
        instructions::create_player::create_player(ctx)
    }

    // 3. Create new game
    pub fn create_game(ctx: Context<CreateGame>, game_id: u64) -> Result<()> {
        instructions::create_game::create_game(ctx, game_id)
    }

    // 4. Join Game
    pub fn join_game(ctx: Context<JoinGame>) -> Result<()> {
        instructions::join_game::join_game(ctx)
    }

    // 5. Make a move
    pub fn play(ctx: Context<Play>, square: Square) -> Result<()> {
        instructions::play::play(ctx, square)
    }

    // 6. Claim reward
    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        instructions::claim_reward::claim_reward(ctx)
    }

}
