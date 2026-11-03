package com.orderpilot.core.security;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

/** Turns the {@code roles} claim (demo tokens and Entra app roles alike) into {@code ROLE_REP}/{@code ROLE_MANAGER}. */
public class RolesClaimConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    static final String ROLES_CLAIM = "roles";

    @Override
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        return rolesOf(jwt).stream()
                .<GrantedAuthority>map(role -> new SimpleGrantedAuthority(role.authority()))
                .toList();
    }

    static List<Role> rolesOf(Jwt jwt) {
        var claim = Optional.ofNullable(jwt.getClaimAsStringList(ROLES_CLAIM)).orElse(List.of());
        return claim.stream().map(Role::fromClaim).flatMap(Optional::stream).distinct().toList();
    }
}
