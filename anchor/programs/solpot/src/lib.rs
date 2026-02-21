use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke;
use anchor_lang::system_program::{transfer, Transfer};

/// Metaplex Core program ID (CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d)
/// Decoded from base58 at compile time using the byte literal.
pub const MPL_CORE_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    0xaf, 0x54, 0xab, 0x10, 0xbd, 0x97, 0xa5, 0x42,
    0xa0, 0x9e, 0xf7, 0xb3, 0x98, 0x89, 0xdd, 0x0c,
    0xd3, 0x94, 0xa4, 0xcc, 0xe9, 0xdf, 0xa6, 0xcd,
    0xc9, 0x7e, 0xbe, 0x2d, 0x23, 0x5b, 0xa7, 0x48,
]);

declare_id!("22tsqvygTkEoomxNduhqEPYKA3DXfPPzNLXVxv9DAp8A");

// ── Errors ──────────────────────────────────────────────────────────────────

#[error_code]
pub enum SolPotError {
    #[msg("Round is not active")]
    RoundNotActive,
    #[msg("Round has expired")]
    RoundExpired,
    #[msg("Round has not expired yet")]
    RoundNotExpired,
    #[msg("Round already has a winner")]
    RoundAlreadyWon,
    #[msg("Player already entered this round")]
    AlreadyEntered,
    #[msg("Maximum players reached")]
    MaxPlayersReached,
    #[msg("Incorrect guess")]
    IncorrectGuess,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Fee basis points must be <= 1000 (10%)")]
    InvalidFeeBasisPoints,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Round is still active")]
    RoundStillActive,
    #[msg("No winner yet")]
    NoWinner,
    #[msg("Pot already distributed")]
    PotAlreadyDistributed,
    #[msg("Invalid word hash")]
    InvalidWordHash,
    #[msg("Entry fee mismatch")]
    EntryFeeMismatch,
    #[msg("NFT already minted for this round")]
    NftAlreadyMinted,
    #[msg("Player has already submitted a guess for this round")]
    AlreadyGuessed,
}

// ── State ───────────────────────────────────────────────────────────────────

#[account]
pub struct GameConfig {
    pub authority: Pubkey,
    pub round_count: u64,
    pub entry_fee_lamports: u64,
    pub fee_basis_points: u16,
    pub bump: u8,
}

impl GameConfig {
    pub const SEED: &'static [u8] = b"game_config";
    pub const SIZE: usize = 8 + 32 + 8 + 8 + 2 + 1;
}

#[account]
pub struct Round {
    pub id: u64,
    pub game_config: Pubkey,
    pub word_hash: [u8; 32],
    pub is_active: bool,
    pub winner: Pubkey,
    pub has_winner: bool,
    pub pot_lamports: u64,
    pub pot_distributed: bool,
    pub nft_minted: bool,
    pub player_count: u32,
    pub max_players: u32,
    pub created_at: i64,
    pub expires_at: i64,
    pub entry_fee_lamports: u64,
    pub bump: u8,
}

impl Round {
    pub const SEED: &'static [u8] = b"round";
    pub const SIZE: usize = 8 + 8 + 32 + 32 + 1 + 32 + 1 + 8 + 1 + 1 + 4 + 4 + 8 + 8 + 8 + 1;
}

#[account]
pub struct PlayerEntry {
    pub player: Pubkey,
    pub round: Pubkey,
    pub entered_at: i64,
    pub bump: u8,
}

impl PlayerEntry {
    pub const SEED: &'static [u8] = b"player_entry";
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1;
}

/// Tiny PDA whose existence proves a player already submitted a guess.
/// Seeds: ["guess_record", round, player]
#[account]
pub struct GuessRecord {
    pub bump: u8,
}

impl GuessRecord {
    pub const SEED: &'static [u8] = b"guess_record";
    pub const SIZE: usize = 8 + 1;
}

#[account]
pub struct Leaderboard {
    pub game_config: Pubkey,
    pub entries: Vec<LeaderboardEntry>,
    pub bump: u8,
}

impl Leaderboard {
    pub const SEED: &'static [u8] = b"leaderboard";
    pub const MAX_ENTRIES: usize = 50;
    pub const SIZE: usize = 8 + 32 + 4 + (Self::MAX_ENTRIES * LeaderboardEntry::SIZE) + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct LeaderboardEntry {
    pub player: Pubkey,
    pub wins: u32,
    pub total_winnings: u64,
}

impl LeaderboardEntry {
    pub const SIZE: usize = 32 + 4 + 8;
}

// ── Events ──────────────────────────────────────────────────────────────────

#[event]
pub struct RoundCreated {
    pub round_id: u64,
    pub entry_fee_lamports: u64,
    pub expires_at: i64,
    pub max_players: u32,
}

#[event]
pub struct PlayerEntered {
    pub round_id: u64,
    pub player: Pubkey,
    pub pot_lamports: u64,
    pub player_count: u32,
}

#[event]
pub struct GuessResult {
    pub round_id: u64,
    pub player: Pubkey,
    pub is_correct: bool,
}

#[event]
pub struct PotDistributed {
    pub round_id: u64,
    pub winner: Pubkey,
    pub winner_amount: u64,
    pub fee_amount: u64,
}

#[event]
pub struct NftMinted {
    pub round_id: u64,
    pub winner: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct RoundClosed {
    pub round_id: u64,
}

// ── Program ─────────────────────────────────────────────────────────────────

#[program]
pub mod solpot {
    use super::*;

    pub fn initialize_game(
        ctx: Context<InitializeGame>,
        entry_fee_lamports: u64,
        fee_basis_points: u16,
    ) -> Result<()> {
        require!(
            fee_basis_points <= 1000,
            SolPotError::InvalidFeeBasisPoints
        );

        let game_config = &mut ctx.accounts.game_config;
        game_config.authority = ctx.accounts.authority.key();
        game_config.round_count = 0;
        game_config.entry_fee_lamports = entry_fee_lamports;
        game_config.fee_basis_points = fee_basis_points;
        game_config.bump = ctx.bumps.game_config;

        let leaderboard = &mut ctx.accounts.leaderboard;
        leaderboard.game_config = game_config.key();
        leaderboard.entries = Vec::new();
        leaderboard.bump = ctx.bumps.leaderboard;

        Ok(())
    }

    pub fn create_round(
        ctx: Context<CreateRound>,
        word_hash: [u8; 32],
        max_players: u32,
        duration_seconds: i64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        let game_config = &mut ctx.accounts.game_config;
        let round = &mut ctx.accounts.round;

        round.id = game_config.round_count;
        round.game_config = game_config.key();
        round.word_hash = word_hash;
        round.is_active = true;
        round.winner = Pubkey::default();
        round.has_winner = false;
        round.pot_lamports = 0;
        round.pot_distributed = false;
        round.nft_minted = false;
        round.player_count = 0;
        round.max_players = max_players;
        round.created_at = clock.unix_timestamp;
        round.expires_at = clock
            .unix_timestamp
            .checked_add(duration_seconds)
            .ok_or(SolPotError::ArithmeticOverflow)?;
        round.entry_fee_lamports = game_config.entry_fee_lamports;
        round.bump = ctx.bumps.round;

        game_config.round_count = game_config
            .round_count
            .checked_add(1)
            .ok_or(SolPotError::ArithmeticOverflow)?;

        emit!(RoundCreated {
            round_id: round.id,
            entry_fee_lamports: round.entry_fee_lamports,
            expires_at: round.expires_at,
            max_players: round.max_players,
        });

        Ok(())
    }

    pub fn enter_round(ctx: Context<EnterRound>) -> Result<()> {
        let round = &mut ctx.accounts.round;

        require!(round.is_active, SolPotError::RoundNotActive);
        require!(!round.has_winner, SolPotError::RoundAlreadyWon);
        require!(
            round.player_count < round.max_players,
            SolPotError::MaxPlayersReached
        );

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < round.expires_at,
            SolPotError::RoundExpired
        );

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player.to_account_info(),
                    to: round.to_account_info(),
                },
            ),
            round.entry_fee_lamports,
        )?;

        round.pot_lamports = round
            .pot_lamports
            .checked_add(round.entry_fee_lamports)
            .ok_or(SolPotError::ArithmeticOverflow)?;
        round.player_count = round
            .player_count
            .checked_add(1)
            .ok_or(SolPotError::ArithmeticOverflow)?;

        let player_entry = &mut ctx.accounts.player_entry;
        player_entry.player = ctx.accounts.player.key();
        player_entry.round = ctx.accounts.round.key();
        player_entry.entered_at = clock.unix_timestamp;
        player_entry.bump = ctx.bumps.player_entry;

        emit!(PlayerEntered {
            round_id: ctx.accounts.round.id,
            player: ctx.accounts.player.key(),
            pot_lamports: ctx.accounts.round.pot_lamports,
            player_count: ctx.accounts.round.player_count,
        });

        Ok(())
    }

    pub fn submit_guess(ctx: Context<SubmitGuess>, guess: String) -> Result<()> {
        // The guess_record PDA is `init` — if it already exists Anchor will
        // reject the tx before we even reach this point (account already in use).
        // So reaching here means this is the player's first guess.
        ctx.accounts.guess_record.bump = ctx.bumps.guess_record;

        let round = &mut ctx.accounts.round;

        require!(round.is_active, SolPotError::RoundNotActive);
        require!(!round.has_winner, SolPotError::RoundAlreadyWon);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < round.expires_at,
            SolPotError::RoundExpired
        );

        let normalized = guess.to_lowercase();
        let guess_hash = hash(normalized.as_bytes());
        let is_correct = guess_hash.to_bytes() == round.word_hash;

        if is_correct {
            round.winner = ctx.accounts.player.key();
            round.has_winner = true;
            round.is_active = false;
        }

        emit!(GuessResult {
            round_id: round.id,
            player: ctx.accounts.player.key(),
            is_correct,
        });

        Ok(())
    }

    pub fn distribute_pot(ctx: Context<DistributePot>) -> Result<()> {
        let pot = ctx.accounts.round.pot_lamports;
        let fee_bps = ctx.accounts.game_config.fee_basis_points;
        let winner_key = ctx.accounts.round.winner;
        let round_id = ctx.accounts.round.id;

        let round_info = ctx.accounts.round.to_account_info();
        let rent = Rent::get()?;
        let min_balance = rent.minimum_balance(round_info.data_len());
        let available = round_info
            .lamports()
            .checked_sub(min_balance)
            .ok_or(SolPotError::ArithmeticOverflow)?;
        let distributable = std::cmp::min(pot, available);

        let fee = distributable
            .checked_mul(fee_bps as u64)
            .and_then(|v| v.checked_div(10000))
            .ok_or(SolPotError::ArithmeticOverflow)?;
        let winner_amount = distributable
            .checked_sub(fee)
            .ok_or(SolPotError::ArithmeticOverflow)?;

        **round_info.try_borrow_mut_lamports()? = round_info
            .lamports()
            .checked_sub(distributable)
            .ok_or(SolPotError::ArithmeticOverflow)?;

        **ctx.accounts.winner.try_borrow_mut_lamports()? = ctx
            .accounts
            .winner
            .lamports()
            .checked_add(winner_amount)
            .ok_or(SolPotError::ArithmeticOverflow)?;

        **ctx.accounts.fee_receiver.try_borrow_mut_lamports()? = ctx
            .accounts
            .fee_receiver
            .lamports()
            .checked_add(fee)
            .ok_or(SolPotError::ArithmeticOverflow)?;

        let round = &mut ctx.accounts.round;
        round.pot_distributed = true;
        round.pot_lamports = 0;

        let leaderboard = &mut ctx.accounts.leaderboard;
        if let Some(entry) = leaderboard
            .entries
            .iter_mut()
            .find(|e| e.player == winner_key)
        {
            entry.wins = entry
                .wins
                .checked_add(1)
                .ok_or(SolPotError::ArithmeticOverflow)?;
            entry.total_winnings = entry
                .total_winnings
                .checked_add(winner_amount)
                .ok_or(SolPotError::ArithmeticOverflow)?;
        } else if leaderboard.entries.len() < Leaderboard::MAX_ENTRIES {
            leaderboard.entries.push(LeaderboardEntry {
                player: winner_key,
                wins: 1,
                total_winnings: winner_amount,
            });
        }
        leaderboard.entries.sort_by(|a, b| b.wins.cmp(&a.wins));

        emit!(PotDistributed {
            round_id,
            winner: winner_key,
            winner_amount,
            fee_amount: fee,
        });

        Ok(())
    }

    pub fn mint_reward_nft(
        ctx: Context<MintRewardNft>,
        name: String,
        uri: String,
    ) -> Result<()> {
        // Build Metaplex Core CreateV1 instruction data manually.
        // CreateV1Args: data_state (u8) + name (String) + uri (String) + plugins (Option<Vec>)
        let mut data: Vec<u8> = Vec::new();
        // Metaplex Core CreateV1 discriminator (enum variant 0)
        data.push(0u8);
        // CreateV1Args:
        //   data_state: DataState enum (0 = AccountState)
        data.push(0u8);
        //   name: borsh String (u32 LE length + bytes)
        data.extend_from_slice(&(name.len() as u32).to_le_bytes());
        data.extend_from_slice(name.as_bytes());
        //   uri: borsh String
        data.extend_from_slice(&(uri.len() as u32).to_le_bytes());
        data.extend_from_slice(uri.as_bytes());
        //   plugins: Option<Vec<PluginAuthorityPair>> = Some(empty vec)
        //   Must use Some([]) not None to match the SDK's serialization format
        data.push(1u8); // Option tag: Some
        data.extend_from_slice(&0u32.to_le_bytes()); // Vec length: 0

        // Metaplex Core uses its own program ID as a sentinel for absent optional accounts.
        let absent = MPL_CORE_PROGRAM_ID;

        let accounts = vec![
            AccountMeta::new(ctx.accounts.asset.key(), true),           // 0: asset (writable, signer)
            AccountMeta::new_readonly(absent, false),                   // 1: collection (absent)
            AccountMeta::new_readonly(absent, false),                   // 2: authority (absent → defaults to payer)
            AccountMeta::new(ctx.accounts.payer.key(), true),           // 3: payer (writable, signer)
            AccountMeta::new_readonly(ctx.accounts.winner.key(), false),// 4: owner (the winner)
            AccountMeta::new_readonly(absent, false),                   // 5: update_authority (absent → defaults to payer)
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false), // 6: system_program
            AccountMeta::new_readonly(absent, false),                   // 7: log_wrapper (absent)
        ];

        let ix = Instruction {
            program_id: MPL_CORE_PROGRAM_ID,
            accounts,
            data,
        };

        invoke(
            &ix,
            &[
                ctx.accounts.asset.to_account_info(),
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.winner.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
                ctx.accounts.mpl_core_program.to_account_info(),
            ],
        )?;

        ctx.accounts.round.nft_minted = true;

        emit!(NftMinted {
            round_id: ctx.accounts.round.id,
            winner: ctx.accounts.winner.key(),
            mint: ctx.accounts.asset.key(),
        });

        Ok(())
    }

    pub fn close_round(ctx: Context<CloseRound>) -> Result<()> {
        let clock = Clock::get()?;

        let expired_no_winner =
            clock.unix_timestamp >= ctx.accounts.round.expires_at && !ctx.accounts.round.has_winner;
        let won_and_distributed =
            ctx.accounts.round.has_winner && ctx.accounts.round.pot_distributed;

        require!(
            expired_no_winner || won_and_distributed,
            SolPotError::RoundStillActive
        );

        if !ctx.accounts.round.has_winner && ctx.accounts.round.pot_lamports > 0 {
            let round_info = ctx.accounts.round.to_account_info();
            let rent = Rent::get()?;
            let min_balance = rent.minimum_balance(round_info.data_len());
            let available = round_info
                .lamports()
                .checked_sub(min_balance)
                .ok_or(SolPotError::ArithmeticOverflow)?;
            let refund = std::cmp::min(ctx.accounts.round.pot_lamports, available);

            **round_info.try_borrow_mut_lamports()? = round_info
                .lamports()
                .checked_sub(refund)
                .ok_or(SolPotError::ArithmeticOverflow)?;

            let authority_info = ctx.accounts.authority.to_account_info();
            **authority_info.try_borrow_mut_lamports()? = authority_info
                .lamports()
                .checked_add(refund)
                .ok_or(SolPotError::ArithmeticOverflow)?;
        }

        let round_id = ctx.accounts.round.id;
        let round = &mut ctx.accounts.round;
        round.pot_lamports = 0;
        round.is_active = false;

        emit!(RoundClosed { round_id });

        Ok(())
    }
}

// ── Account Contexts ────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeGame<'info> {
    #[account(
        init,
        payer = authority,
        space = GameConfig::SIZE,
        seeds = [GameConfig::SEED],
        bump,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        init,
        payer = authority,
        space = Leaderboard::SIZE,
        seeds = [Leaderboard::SEED, game_config.key().as_ref()],
        bump,
    )]
    pub leaderboard: Account<'info, Leaderboard>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateRound<'info> {
    #[account(
        mut,
        seeds = [GameConfig::SEED],
        bump = game_config.bump,
        has_one = authority,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        init,
        payer = authority,
        space = Round::SIZE,
        seeds = [
            Round::SEED,
            game_config.key().as_ref(),
            &game_config.round_count.to_le_bytes(),
        ],
        bump,
    )]
    pub round: Account<'info, Round>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EnterRound<'info> {
    #[account(
        seeds = [GameConfig::SEED],
        bump = game_config.bump,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        mut,
        seeds = [
            Round::SEED,
            round.game_config.as_ref(),
            &round.id.to_le_bytes(),
        ],
        bump = round.bump,
        constraint = round.game_config == game_config.key(),
    )]
    pub round: Account<'info, Round>,

    #[account(
        init,
        payer = player,
        space = PlayerEntry::SIZE,
        seeds = [
            PlayerEntry::SEED,
            round.key().as_ref(),
            player.key().as_ref(),
        ],
        bump,
    )]
    pub player_entry: Account<'info, PlayerEntry>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitGuess<'info> {
    #[account(
        mut,
        seeds = [
            Round::SEED,
            round.game_config.as_ref(),
            &round.id.to_le_bytes(),
        ],
        bump = round.bump,
    )]
    pub round: Account<'info, Round>,

    #[account(
        seeds = [
            PlayerEntry::SEED,
            round.key().as_ref(),
            player.key().as_ref(),
        ],
        bump,
        has_one = player,
        has_one = round,
    )]
    pub player_entry: Account<'info, PlayerEntry>,

    #[account(
        init,
        payer = player,
        space = GuessRecord::SIZE,
        seeds = [
            GuessRecord::SEED,
            round.key().as_ref(),
            player.key().as_ref(),
        ],
        bump,
    )]
    pub guess_record: Account<'info, GuessRecord>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DistributePot<'info> {
    #[account(
        seeds = [GameConfig::SEED],
        bump = game_config.bump,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        mut,
        seeds = [
            Round::SEED,
            round.game_config.as_ref(),
            &round.id.to_le_bytes(),
        ],
        bump = round.bump,
        constraint = round.game_config == game_config.key(),
        constraint = round.has_winner @ SolPotError::NoWinner,
        constraint = !round.pot_distributed @ SolPotError::PotAlreadyDistributed,
    )]
    pub round: Account<'info, Round>,

    /// CHECK: Winner account verified against round.winner
    #[account(
        mut,
        constraint = winner.key() == round.winner @ SolPotError::Unauthorized,
    )]
    pub winner: AccountInfo<'info>,

    /// CHECK: Fee receiver verified against game_config.authority
    #[account(
        mut,
        constraint = fee_receiver.key() == game_config.authority @ SolPotError::Unauthorized,
    )]
    pub fee_receiver: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [Leaderboard::SEED, game_config.key().as_ref()],
        bump = leaderboard.bump,
    )]
    pub leaderboard: Account<'info, Leaderboard>,
}

#[derive(Accounts)]
pub struct MintRewardNft<'info> {
    #[account(
        seeds = [GameConfig::SEED],
        bump = game_config.bump,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        mut,
        seeds = [
            Round::SEED,
            round.game_config.as_ref(),
            &round.id.to_le_bytes(),
        ],
        bump = round.bump,
        constraint = round.has_winner @ SolPotError::NoWinner,
        constraint = !round.nft_minted @ SolPotError::NftAlreadyMinted,
    )]
    pub round: Box<Account<'info, Round>>,

    /// CHECK: New Metaplex Core asset account (created by CPI)
    #[account(mut, signer)]
    pub asset: AccountInfo<'info>,

    /// CHECK: Winner account verified against round.winner
    #[account(
        constraint = winner.key() == round.winner @ SolPotError::Unauthorized,
    )]
    pub winner: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Metaplex Core program verified by address constraint
    #[account(address = MPL_CORE_PROGRAM_ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseRound<'info> {
    #[account(
        seeds = [GameConfig::SEED],
        bump = game_config.bump,
        has_one = authority,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        mut,
        seeds = [
            Round::SEED,
            round.game_config.as_ref(),
            &round.id.to_le_bytes(),
        ],
        bump = round.bump,
        constraint = round.game_config == game_config.key(),
    )]
    pub round: Account<'info, Round>,

    /// CHECK: Authority receives refunded SOL if round expired without winner
    #[account(mut)]
    pub authority: Signer<'info>,
}
