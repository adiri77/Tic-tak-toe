use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use crate::state::program_state::*;

pub fn init(ctx: Context<Init>) -> Result<()> {
    let program_state = &mut ctx.accounts.program_state;
    program_state.init(ctx.bumps.program_state);
    Ok(())
}

#[derive(Accounts)]
pub struct Init<'info> {
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = mint,
        seeds = [b"play_token_mint"], 
        bump
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    #[account(
        init,
        payer = payer,
        space = 200,
        seeds = [b"program_state"], 
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
}
